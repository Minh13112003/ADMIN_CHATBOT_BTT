import { BadRequestException, ConflictException, Controller, Get, HttpCode, Injectable, Logger, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { tomTat } from '../common/text';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { TourInterestService } from '../tour-interest/tour-interest.service';
import { THE_XIN_SDT, ZaloService } from './zalo.service';

/**
 * Kéo tin cũ của một khách Zalo về hội thoại. Chỉ GHI LẠI lịch sử: không trả lời tự động, không đổi trạng thái hội thoại,
 * không báo nhân viên, không đụng tin xem trước của danh sách. Tin đã có thì bỏ qua (theo mã tin, hoặc cùng nội dung và gần giờ).
 */
export type TienDoNhap = { dang: boolean; tong: number; xong: number; khachMoi: number; tinThem: number; loi: number; lyDo: string | null; batDau: string | null; ketThuc: string | null };
const TIEN_DO_RONG: TienDoNhap = { dang: false, tong: 0, xong: 0, khachMoi: 0, tinThem: 0, loi: 0, lyDo: null, batDau: null, ketThuc: null };
const nghi = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class ZaloSyncService {
  private log = new Logger('ZaloSync');
  private tienDo: TienDoNhap = { ...TIEN_DO_RONG };
  constructor(private prisma: PrismaService, private zalo: ZaloService, private realtime: RealtimeGateway, private nhuCau: TourInterestService) {}

  /** Sau khi kéo tin cũ: nhận địa điểm khách hỏi theo đúng ngày của từng tin (chủ dự án yêu cầu 2026-11-13). Lỗi chỉ ghi log. */
  private async quetDiaDiem(conversationId: string) {
    try {
      await this.nhuCau.quetHoiThoai(conversationId);
    } catch (e) {
      this.log.warn(`Không quét được địa điểm cho tin cũ: ${(e as Error).message}`);
    }
  }

  layTienDo(): TienDoNhap {
    return this.tienDo;
  }

  /** Admin bấm "Nhập khách cũ từ Zalo": chạy nền, trả về ngay; xem tiến độ qua layTienDo. Không chạy hai lần cùng lúc. */
  batDauNhapKhachCu(toiDaKhach = 300, nghiMs = 400): TienDoNhap {
    if (this.tienDo.dang) throw new ConflictException('Đang nhập khách cũ, đợi chạy xong nhé');
    this.tienDo = { ...TIEN_DO_RONG, dang: true, batDau: new Date().toISOString() };
    void this.chayNhap(toiDaKhach, nghiMs).catch((e: Error) => {
      this.log.error(`Nhập khách cũ lỗi: ${e.message}`);
      this.tienDo = { ...this.tienDo, dang: false, lyDo: e.message, ketThuc: new Date().toISOString() };
    });
    return this.tienDo;
  }

  /**
   * Nhập các khách đã nhắn OA từ trước khi nối (webhook chỉ báo tin mới). Mỗi khách: tạo khách và hội thoại nếu chưa có
   * (trạng thái Đã xem, chưa phân công, không báo nhân viên), rồi kéo lịch sử tin. Nghỉ giữa các khách để không vượt giới hạn gọi của Zalo.
   */
  private async chayNhap(toiDaKhach: number, nghiMs: number) {
    const ds = await this.zalo.chatGanDay(toiDaKhach);
    this.tienDo = { ...this.tienDo, tong: ds.length };
    for (const k of ds) {
      try {
        const { conversationId, moi } = await this.taoNeuChua(k);
        const r = await this.dongBo(conversationId, 50);
        await this.capNhatTomTat(conversationId);
        this.tienDo = { ...this.tienDo, xong: this.tienDo.xong + 1, khachMoi: this.tienDo.khachMoi + (moi ? 1 : 0), tinThem: this.tienDo.tinThem + r.them };
      } catch (e) {
        this.log.warn(`Nhập khách Zalo ${k.userId} lỗi: ${(e as Error).message}`);
        this.tienDo = { ...this.tienDo, xong: this.tienDo.xong + 1, loi: this.tienDo.loi + 1 };
      }
      await nghi(nghiMs);
    }
    this.tienDo = { ...this.tienDo, dang: false, ketThuc: new Date().toISOString() };
    this.realtime.emit('conversation:update', {});
    this.log.log(`Nhập khách cũ xong: ${this.tienDo.xong}/${this.tienDo.tong} khách, ${this.tienDo.khachMoi} khách mới, ${this.tienDo.tinThem} tin, ${this.tienDo.loi} lỗi`);
  }

  private async taoNeuChua(k: { userId: string; ten: string | null; anh: string | null; gio: Date; text: string }): Promise<{ conversationId: string; moi: boolean }> {
    const cu = await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel: 'ZALO', externalId: k.userId } }, select: { customerId: true } });
    if (cu) {
      const c = await this.prisma.conversation.findUnique({ where: { customerId_channel: { customerId: cu.customerId, channel: 'ZALO' } }, select: { id: true } });
      if (c) return { conversationId: c.id, moi: false };
    }
    // Danh sách chat gần đây có thể thiếu tên/ảnh: hỏi hồ sơ Zalo (lỗi thì dùng tên mặc định).
    const hoSo = !k.ten || !k.anh ? await this.zalo.hoSoKhach(k.userId) : { ten: null, anh: null };
    const ten = k.ten ?? hoSo.ten ?? 'Khách chưa rõ tên';
    const anh = k.anh ?? hoSo.anh;
    const conversationId = await this.prisma.$transaction(async (tx) => {
      const customerId = cu?.customerId ?? (await tx.customer.create({ data: { name: ten, avatarUrl: anh } })).id;
      if (!cu) await tx.customerIdentity.create({ data: { channel: 'ZALO', externalId: k.userId, customerId } });
      const c = await tx.conversation.create({
        data: { customerId, channel: 'ZALO', status: 'READ', mode: 'BOT', lastMessageAt: k.gio, lastMessagePreview: tomTat(k.text || '[Tin nhắn Zalo]') },
        select: { id: true },
      });
      return c.id;
    });
    return { conversationId, moi: true };
  }

  /** Sau khi kéo lịch sử: đưa giờ và dòng xem trước của danh sách về tin mới nhất (chỉ khi mới hơn giá trị đang có). */
  private async capNhatTomTat(conversationId: string) {
    const cuoi = await this.prisma.message.findFirst({ where: { conversationId, internal: false }, orderBy: { createdAt: 'desc' }, select: { text: true, createdAt: true } });
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { lastMessageAt: true } });
    if (cuoi && c && cuoi.createdAt > c.lastMessageAt) {
      await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: cuoi.createdAt, lastMessagePreview: tomTat(cuoi.text) } });
    }
  }

  /**
   * Gửi thẻ xin thông tin qua Zalo. Thẻ hiện thành tin nhân viên trong khung chat (như trên điện thoại) và đưa hội thoại lên đầu danh sách.
   * Zalo lỗi (hết khung 48 giờ...) thì báo lỗi, không ghi gì.
   */
  async xinSdt(user: AuthUser, conversationId: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { channel: true, customerId: true } });
    if (!c || c.channel !== 'ZALO') throw new BadRequestException('Chỉ xin số qua Zalo được với hội thoại Zalo');
    const danhTinh = await this.prisma.customerIdentity.findFirst({ where: { customerId: c.customerId, channel: 'ZALO' }, select: { externalId: true } });
    if (!danhTinh) throw new BadRequestException('Không tìm thấy tài khoản Zalo của khách này');
    const maTin = await this.zalo.xinThongTin(danhTinh.externalId);
    const now = new Date();
    const text = `[Thẻ xin thông tin] ${THE_XIN_SDT.title}\n${THE_XIN_SDT.subtitle}`;
    const [m] = await this.prisma.$transaction([
      this.prisma.message.create({ data: { conversationId, senderType: 'STAFF', staffLabel: user.fullName, text, externalMessageId: maTin ? `zalo:${maTin}` : undefined, createdAt: now } }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now, lastMessagePreview: tomTat(`Đã gửi thẻ xin số điện thoại`) } }),
    ]);
    this.realtime.emit('message:new', { conversationId, message: m });
    this.realtime.emit('conversation:update', { id: conversationId });
    return { ok: true };
  }

  async dongBo(conversationId: string, toiDa = 50): Promise<{ them: number; tong: number }> {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { channel: true, customerId: true } });
    if (!c || c.channel !== 'ZALO') throw new BadRequestException('Chỉ dùng được cho hội thoại Zalo');
    const danhTinh = await this.prisma.customerIdentity.findFirst({ where: { customerId: c.customerId, channel: 'ZALO' }, select: { externalId: true } });
    if (!danhTinh) throw new BadRequestException('Không tìm thấy tài khoản Zalo của khách này');

    const tin = await this.zalo.layLichSu(danhTinh.externalId, toiDa);
    if (!tin.length) return { them: 0, tong: 0 };

    const daCoMa = await this.prisma.message.findMany({ where: { externalMessageId: { in: tin.map((t) => `zalo:${t.msgId}`) } }, select: { id: true, externalMessageId: true, text: true, attachmentPath: true } });
    const maCo = new Set(daCoMa.map((m) => m.externalMessageId));
    // Tin đã có nhưng trước đây chỉ ghi dòng "xem trên Zalo OA": nay tải được ảnh/PDF thì gắn tệp vào đúng tin đó.
    let nangCap = 0;
    for (const cu of daCoMa) {
      if (cu.attachmentPath || !cu.text?.includes('xem trên Zalo OA')) continue;
      const t = tin.find((x) => `zalo:${x.msgId}` === cu.externalMessageId);
      // Không lọc theo loại: Zalo có thể trả tin ảnh với loại "text". Tệp tải về được kiểm tra theo nội dung nên link trang web sẽ bị bỏ.
      const tep = t?.url ? await this.zalo.taiTep(t.url, t.ten) : null;
      if (!tep) {
        // Không có tệp: cập nhật dòng chữ thay thế cho đúng loại tin (bản cũ ghi chung "OA gửi tin nhắn").
        if (t && t.text !== cu.text) await this.prisma.message.update({ where: { id: cu.id }, data: { text: t.text } });
        continue;
      }
      await this.prisma.message.update({ where: { id: cu.id }, data: { text: t!.chu ?? '', attachmentPath: tep.path, attachmentType: tep.type, attachmentName: tep.name, attachmentSize: tep.size } });
      nangCap++;
    }
    if (nangCap) this.realtime.emit('conversation:update', { id: conversationId });
    // Tin nhận trực tiếp qua webhook có thể mang mã khác với mã trong lịch sử: so thêm theo nội dung và giờ.
    const tuGio = new Date(tin[0].thoiGian.getTime() - 5 * 60_000);
    const gan = await this.prisma.message.findMany({ where: { conversationId, senderType: { in: ['CUSTOMER', 'STAFF'] }, createdAt: { gte: tuGio } }, select: { text: true, createdAt: true, senderType: true } });
    const trung = (t: (typeof tin)[number]) => gan.some((g) => g.text === t.text && (g.senderType === 'CUSTOMER') === t.tuKhach && Math.abs(g.createdAt.getTime() - t.thoiGian.getTime()) < 3 * 60_000);
    const moi = tin.filter((t) => !maCo.has(`zalo:${t.msgId}`) && !trung(t));
    if (!moi.length) {
      if (nangCap) this.realtime.emit('message:new', { conversationId });
      await this.quetDiaDiem(conversationId);
      return { them: 0, tong: tin.length };
    }

    const data = [];
    for (const t of moi) {
      // Ảnh/PDF: tải về lưu để xem trong khung chat; không tải được thì giữ dòng chữ thay thế.
      const tep = t.url ? await this.zalo.taiTep(t.url, t.ten) : null;
      data.push({
        conversationId,
        senderType: t.tuKhach ? ('CUSTOMER' as const) : ('STAFF' as const),
        ...(t.tuKhach ? {} : { staffLabel: 'Zalo OA' }),
        text: tep ? (t.chu ?? '') : t.text,
        externalMessageId: `zalo:${t.msgId}`,
        createdAt: t.thoiGian,
        ...(tep ? { attachmentPath: tep.path, attachmentType: tep.type, attachmentName: tep.name, attachmentSize: tep.size } : {}),
      });
    }
    await this.prisma.message.createMany({ data, skipDuplicates: true });
    // Tin trả lời (trích) một tin khác: nối sau khi đã ghi, vì tin được trích có thể nằm ngay trong đợt này.
    for (const t of moi.filter((x) => x.trichMa)) {
      const goc = await this.prisma.message.findFirst({ where: { conversationId, externalMessageId: `zalo:${t.trichMa}` }, select: { id: true } });
      if (goc) await this.prisma.message.updateMany({ where: { externalMessageId: `zalo:${t.msgId}`, replyToId: null }, data: { replyToId: goc.id } });
    }
    this.realtime.emit('conversation:update', { id: conversationId });
    this.realtime.emit('message:new', { conversationId });
    await this.quetDiaDiem(conversationId);
    return { them: moi.length, tong: tin.length };
  }
}

@Controller('conversations')
export class ZaloSyncController {
  constructor(private sync: ZaloSyncService) {}

  /** Sale hoặc admin bấm "Xin số điện thoại": gửi thẻ chia sẻ thông tin của Zalo cho khách. */
  @Post(':id/zalo-request-phone')
  @HttpCode(200)
  xinSdt(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.sync.xinSdt(me, id);
  }

  /** Admin bấm "Đồng bộ tin cũ từ Zalo" trong menu ⋯ của hội thoại Zalo. */
  @Roles(Role.ADMIN)
  @Post(':id/zalo-history')
  @HttpCode(200)
  dongBo(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.dongBo(id);
  }
}

@Controller('channel-settings/zalo')
export class ZaloImportController {
  constructor(private sync: ZaloSyncService) {}

  /** Bắt đầu nhập khách cũ (chạy nền). Chỉ ADMIN. */
  @Roles(Role.ADMIN)
  @Post('import-old')
  @HttpCode(200)
  batDau() {
    return this.sync.batDauNhapKhachCu();
  }

  @Roles(Role.ADMIN)
  @Get('import-status')
  tienDo() {
    return this.sync.layTienDo();
  }
}
