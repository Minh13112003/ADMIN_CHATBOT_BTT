import { ZaloService } from '../channels/zalo.service';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Channel, ConversationStatus, Prisma, Role } from '../generated/prisma/client';
import { AuthUser } from '../auth/auth.decorators';
import { tomTatDinhKem } from '../common/attachments';
import { dongNghiepDangNhan, nguoiPhuTrachSauKhiGui, vaiTro } from '../common/locks';
import { chuanHoaSoDienThoai, khoaTimKiem, tomTat, truyVanTin } from '../common/text';
import { locHoiThoai, phamViPhong, sqlPhamHoiThoai } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AttachmentsService } from '../storage/attachments.service';
import { PricingService } from '../tours/pricing.service';

const INCLUDE = {
  customer: { select: { id: true, name: true, aliases: true, phone: true, phoneVerified: true, avatarUrl: true } },
  assignee: { select: { id: true, fullName: true } },
  followUpBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ConversationInclude;

type ConvRow = Prisma.ConversationGetPayload<{ include: typeof INCLUDE }>;

/** Tìm theo tên, tên khác hoặc SĐT, không phân biệt dấu. `searchText` có chỉ mục trigram nên LIKE '%...%' vẫn nhanh. */
function timKhach(search?: string): Prisma.CustomerWhereInput | undefined {
  const tu = khoaTimKiem(search ?? '');
  return tu.length ? { AND: tu.map((t) => ({ searchText: { contains: t } })) } : undefined;
}

const MESSAGE_SELECT = {
  id: true,
  senderType: true,
  staffLabel: true,
  ruleName: true,
  text: true,
  internal: true,
  isTrigger: true,
  tours: true,
  createdAt: true,
  attachmentPath: true,
  attachmentType: true,
  attachmentName: true,
  attachmentSize: true,
  replyTo: { select: { id: true, text: true, senderType: true } },
} satisfies Prisma.MessageSelect;

export type CloseInput = { dealId?: string; tourKey?: string; dayCode: string; guests: number; voucherCode?: string; orderCode?: string };
export type PatchInput = { tags?: string[]; note?: string; interest?: string; autoReplyOn?: boolean; followUpAt?: string | null; followUpNote?: string };

@Injectable()
export class ConversationsService {
  private log = new Logger('Conversations');

  constructor(private prisma: PrismaService, private config: ConfigService, private realtime: RealtimeGateway, private tep: AttachmentsService, private pricing: PricingService, private zalo: ZaloService) {}

  /** Bỏ đường dẫn lưu trữ, thêm `attachment` (link xem có hạn) trước khi gửi ra ngoài. */
  private ra<T extends { id: string; attachmentPath: string | null; attachmentType: string | null; attachmentName: string | null; attachmentSize: number | null }>(m: T) {
    const { attachmentPath, attachmentType, attachmentName, attachmentSize, ...con } = m;
    return { ...con, attachment: this.tep.dinhKem(m) };
  }

  /** Đồng nghiệp gửi tin trong khoảng này thì người khác bấm gửi sẽ được hỏi xác nhận. */
  private get canhBaoMs() {
    return Number(this.config.get('COLLISION_WARN_SECONDS') ?? 60) * 1000;
  }

  /** Đồng nghiệp đang gõ (giao diện báo mỗi 5 giây khi đang gõ). */
  private static readonly DANG_GO_MS = 15_000;

  /** Đồng nghiệp đang gõ, hoặc vừa gửi tin trong `canhBaoMs`. Đang gõ được ưu tiên vì đó là việc đang xảy ra. */
  private async dongNghiep(c: ConvRow, userId: string, ten: Map<string, string>): Promise<{ id: string; fullName: string; typing: boolean } | null> {
    const go = await this.realtime.dangGo(c.id, userId, ConversationsService.DANG_GO_MS);
    if (go) return { id: go.id, fullName: go.name, typing: true };
    const gui = dongNghiepDangNhan(c, userId, new Date(), this.canhBaoMs);
    return gui ? { id: gui, fullName: ten.get(gui) ?? 'Đồng nghiệp', typing: false } : null;
  }

  private async tenNhanVien(): Promise<Map<string, string>> {
    const rows = await this.prisma.user.findMany({ where: { role: Role.SALE }, select: { id: true, fullName: true } });
    return new Map(rows.map((r) => [r.id, r.fullName]));
  }

  async toDto(c: ConvRow, userId: string, ten: Map<string, string>) {
    const khac = await this.dongNghiep(c, userId, ten);
    return {
      id: c.id,
      channel: c.channel,
      status: c.status,
      mode: c.mode,
      customer: c.customer,
      assignee: c.assignee,
      role: vaiTro(c, userId),
      activeOther: khac ? { id: khac.id, fullName: khac.fullName } : null,
      autoReplyOn: c.autoReplyOn,
      interest: c.interest,
      tags: c.tags,
      note: c.note,
      followUp: c.followUpAt ? { at: c.followUpAt, note: c.followUpNote, by: c.followUpBy } : null,
      customerSeenAt: c.customerSeenAt,
      lastMessageAt: c.lastMessageAt,
      lastMessagePreview: c.lastMessagePreview,
    };
  }

  async list(user: AuthUser, q: { status?: ConversationStatus; channel?: Channel; search?: string; take?: number; tag?: string; followUp?: boolean }) {
    const tim = timKhach(q.search);
    const where: Prisma.ConversationWhereInput = {
      ...this.pham(user),
      ...(q.channel ? { channel: q.channel } : {}),
      ...(tim ? { customer: tim } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
      ...(q.followUp ? { followUpAt: { not: null } } : {}),
    };
    const take = Math.min(q.take ?? 100, 500);
    const ten = await this.tenNhanVien();
    if (q.followUp) {
      // Danh sách hẹn nhắc: hẹn sớm nhất lên đầu, không tách Liên hệ.
      const [items, counts] = await Promise.all([
        this.prisma.conversation.findMany({ where: q.status ? { ...where, status: q.status } : where, include: INCLUDE, orderBy: { followUpAt: 'asc' }, take }),
        this.prisma.conversation.groupBy({ by: ['status'], where, _count: { _all: true } }),
      ]);
      return { items: await Promise.all(items.map((c) => this.toDto(c, user.id, ten))), counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])), hasMore: items.length === take };
    }
    const whereStatus = q.status ? { ...where, status: q.status } : where;
    // Liên hệ luôn ghim đầu, sau đó mới theo tin mới nhất.
    const [contacts, others, counts] = await Promise.all([
      q.status && q.status !== 'CONTACT'
        ? Promise.resolve([] as ConvRow[])
        : this.prisma.conversation.findMany({ where: { ...where, status: 'CONTACT' }, include: INCLUDE, orderBy: { contactRequestedAt: 'asc' } }),
      q.status === 'CONTACT'
        ? Promise.resolve([] as ConvRow[])
        : this.prisma.conversation.findMany({
            where: { ...whereStatus, ...(q.status ? {} : { status: { not: 'CONTACT' } }) },
            include: INCLUDE,
            orderBy: { lastMessageAt: 'desc' },
            take,
          }),
      this.prisma.conversation.groupBy({ by: ['status'], where, _count: { _all: true } }),
    ]);
    return {
      items: await Promise.all([...contacts, ...others].map((c) => this.toDto(c, user.id, ten))),
      counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      hasMore: others.length === take,
    };
  }

  /** Admin phòng chỉ thấy hội thoại của phòng mình; sale và admin toàn quyền như cũ. */
  private pham(user: AuthUser): Prisma.ConversationWhereInput {
    return user.role === Role.DEPT_ADMIN ? locHoiThoai(phamViPhong(user)) : {};
  }

  private async lay(id: string): Promise<ConvRow> {
    const c = await this.prisma.conversation.findUnique({ where: { id }, include: INCLUDE });
    if (!c) throw new NotFoundException('Không tìm thấy hội thoại');
    return c;
  }

  async get(user: AuthUser, id: string) {
    return this.toDto(await this.lay(id), user.id, await this.tenNhanVien());
  }

  async messages(id: string, before?: string, take = 100, around?: string) {
    await this.lay(id);
    const n = Math.min(take, 200);
    if (around) {
      // Mở thẳng tới một tin: 20 tin trước nó, chính nó và các tin sau.
      const dich = await this.prisma.message.findFirst({ where: { id: around, conversationId: id }, select: { createdAt: true } });
      if (!dich) throw new NotFoundException('Không tìm thấy tin nhắn này');
      const [truoc, sau] = await Promise.all([
        this.prisma.message.findMany({ where: { conversationId: id, createdAt: { lt: dich.createdAt } }, orderBy: { createdAt: 'desc' }, take: 21, select: MESSAGE_SELECT }),
        this.prisma.message.findMany({ where: { conversationId: id, createdAt: { gte: dich.createdAt } }, orderBy: { createdAt: 'asc' }, take: n, select: MESSAGE_SELECT }),
      ]);
      return { items: [...truoc.slice(0, 20).reverse(), ...sau].map((m) => this.ra(m)), hasMore: truoc.length > 20 };
    }
    const rows = await this.prisma.message.findMany({
      where: { conversationId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: n + 1,
      select: MESSAGE_SELECT,
    });
    return { items: rows.slice(0, n).reverse().map((m) => this.ra(m)), hasMore: rows.length > n };
  }

  private async ghiLog(id: string, text: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.message.create({ data: { conversationId: id, senderType: 'SYSTEM', internal: true, text }, select: MESSAGE_SELECT });
  }

  private async capNhat(user: AuthUser, id: string, data: Prisma.ConversationUncheckedUpdateInput, log?: string) {
    const conv = await this.prisma.conversation.update({ where: { id }, data, include: INCLUDE });
    if (log) {
      const m = await this.ghiLog(id, log);
      this.realtime.emit('message:new', { conversationId: id, message: this.ra(m) });
    }
    this.realtime.emit('conversation:update', { id });
    return this.toDto(conv, user.id, await this.tenNhanVien());
  }

  async read(user: AuthUser, id: string) {
    await this.prisma.conversation.updateMany({ where: { id, status: 'UNREAD' }, data: { status: 'READ' } });
    this.realtime.emit('conversation:update', { id });
    return this.get(user, id);
  }

  /**
   * Sale nào cũng gửi được ("trả lời là nhận", xem common/locks.ts).
   * Đồng nghiệp đang soạn hoặc vừa gửi thì trả 409 OTHER_ACTIVE, giao diện hỏi lại rồi gửi kèm `confirm`.
   */
  async send(user: AuthUser, id: string, dto: { text?: string; confirm?: boolean; replyToId?: string }, file?: { buffer: Buffer; originalname?: string }) {
    const c = await this.lay(id);
    const noiDung = (dto.text ?? '').trim();
    if (!noiDung && !file) throw new BadRequestException('Tin nhắn đang trống');
    const now = new Date();
    const khac = await this.dongNghiep(c, user.id, await this.tenNhanVien());
    if (khac && !dto.confirm) {
      const viec = khac.typing ? 'đang soạn tin cho khách này' : 'vừa nhắn với khách này';
      throw new ConflictException({ code: 'OTHER_ACTIVE', by: khac.fullName, message: `${khac.fullName} ${viec}. Bạn vẫn muốn gửi?` });
    }
    if (dto.replyToId) {
      const goc = await this.prisma.message.findFirst({ where: { id: dto.replyToId, conversationId: id, internal: false }, select: { id: true } });
      if (!goc) throw new BadRequestException('Không tìm thấy tin được trích');
    }
    // Kênh Zalo: gửi sang Zalo trước khi lưu, lỗi thì báo ngay và không lưu tin giả vờ đã gửi.
    if (c.channel === 'ZALO') {
      if (file) throw new BadRequestException('Zalo OA chưa hỗ trợ gửi ảnh/PDF từ trang này, bạn nhắn chữ giúp nhé');
      const danhTinh = await this.prisma.customerIdentity.findFirst({ where: { customerId: c.customerId, channel: 'ZALO' }, select: { externalId: true } });
      if (!danhTinh) throw new BadRequestException('Không tìm thấy tài khoản Zalo của khách này');
      await this.zalo.guiTin(danhTinh.externalId, noiDung);
    }
    // Lưu file sau cùng các kiểm tra khác để không tải lên rồi mới báo lỗi.
    const dinhKem = file ? await this.tep.luu(file) : null;

    const sau = nguoiPhuTrachSauKhiGui(c, user.id);
    const nguoiCu = c.assignee?.fullName;
    const logs: string[] = [];
    if (sau.nhanKhach) {
      if (c.assigneeId && c.assigneeId !== user.id) logs.push(`${user.fullName} trả lời trước nên nhận khách thay ${nguoiCu}`);
      else logs.push(`${user.fullName} trả lời và nhận xử lý, bot và trả lời tự động dừng`);
    }
    if (c.helperId) logs.push(`${user.fullName} nhắn với khách`); // Dữ liệu cũ còn người "xử lý hộ": xoá khi có tin mới.

    const { message, them } = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: id,
          senderType: 'STAFF',
          staffId: user.id,
          staffLabel: sau.hoTro ? `${user.fullName} (hỗ trợ ${nguoiCu})` : user.fullName,
          text: noiDung,
          replyToId: dto.replyToId,
          ...(dinhKem ? { attachmentPath: dinhKem.path, attachmentType: dinhKem.type, attachmentName: dinhKem.name, attachmentSize: dinhKem.size } : {}),
          createdAt: now,
        },
        select: MESSAGE_SELECT,
      });
      const them = [];
      for (const [i, text] of logs.entries()) {
        them.push(await tx.message.create({ data: { conversationId: id, senderType: 'SYSTEM', internal: true, text, createdAt: new Date(now.getTime() - logs.length + i) }, select: MESSAGE_SELECT }));
      }
      if (c.status === 'CONTACT' && c.contactRequestedAt) {
        await tx.contactResponse.create({
          data: { conversationId: id, staffId: user.id, requestedAt: c.contactRequestedAt, respondedAt: now, seconds: Math.max(0, Math.round((now.getTime() - c.contactRequestedAt.getTime()) / 1000)) },
        });
      }
      await tx.conversation.update({
        where: { id },
        data: {
          assigneeId: sau.assigneeId,
          ...(sau.nhanKhach ? { lastHandlerId: user.id, mode: 'STAFF' as const } : {}),
          helperId: null,
          lastMessageAt: now,
          lastMessagePreview: dinhKem ? tomTat(tomTatDinhKem(noiDung, dinhKem.type, dinhKem.name)) : tomTat(noiDung),
          lastStaffActivityAt: now,
          lastStaffActivityBy: user.id,
          // Đã trả lời thì khách không còn ở diện chờ gấp, bỏ ghim Liên hệ.
          ...(c.status === 'CONTACT' ? { status: 'PENDING' as const } : {}),
        },
      });
      return { message, them };
    });
    await this.realtime.xongGo(id, user.id);
    for (const m of [...them, message]) this.realtime.emit('message:new', { conversationId: id, message: this.ra(m) });
    this.realtime.emit('conversation:update', { id });
    if (sau.hoTro && c.assigneeId) {
      this.realtime.emit('support:new', { id, toUserId: c.assigneeId, by: user.fullName, name: c.customer.name });
    }
    return this.ra(message);
  }

  async giveBack(user: AuthUser, id: string) {
    const c = await this.lay(id);
    if (c.assigneeId !== user.id) throw new ForbiddenException('Chỉ người phụ trách mới trả lại cho bot được');
    return this.capNhat(
      user,
      id,
      { assigneeId: null, helperId: null, mode: 'BOT', status: c.status === 'CLOSED' ? 'CLOSED' : 'READ', lastStaffActivityAt: null, lastStaffActivityBy: null },
      `${user.fullName} đã trả hội thoại lại cho bot`,
    );
  }

  /** Chuyển khách cho đồng nghiệp, kèm ghi chú nội bộ. Ai trong nhóm sale cũng chuyển được, log ghi rõ ai chuyển. */
  async handover(user: AuthUser, id: string, toUserId: string, ghiChu?: string) {
    const c = await this.lay(id);
    const den = await this.prisma.user.findFirst({ where: { id: toUserId, role: Role.SALE, isActive: true }, select: { id: true, fullName: true } });
    if (!den || den.id === c.assigneeId) throw new BadRequestException('Đồng nghiệp không hợp lệ');
    const tu = c.assignee && c.assignee.id !== user.id ? ` từ ${c.assignee.fullName}` : '';
    const note = ghiChu?.trim() ? `: ${ghiChu.trim()}` : '';
    const kq = await this.capNhat(
      user,
      id,
      { assigneeId: den.id, lastHandlerId: den.id, helperId: null, lastStaffActivityAt: null, lastStaffActivityBy: null },
      `${user.fullName} chuyển khách${tu} cho ${den.fullName}${note}`,
    );
    this.realtime.emit('support:new', { id, toUserId: den.id, by: user.fullName, name: c.customer.name, handover: true });
    return kq;
  }

  /** Đổi trạng thái thủ công. Chốt đơn phải đi qua close() để có số doanh thu. */
  async setStatus(user: AuthUser, id: string, status: ConversationStatus) {
    if (status === 'CLOSED') throw new BadRequestException('Dùng chức năng Chốt tour để nhập đơn');
    const c = await this.lay(id);
    if (c.status === 'CLOSED') await this.prisma.deal.updateMany({ where: { conversationId: id, voidedAt: null, status: 'CONFIRMED' }, data: { voidedAt: new Date() } });
    const log = c.status === 'CLOSED' ? `${user.fullName} mở lại hội thoại, đơn đã chốt không còn tính doanh thu` : undefined;
    return this.capNhat(user, id, { status, ...(status === 'CONTACT' ? { contactRequestedAt: new Date() } : {}) }, log);
  }

  /**
   * Chốt tour. Có `dealId` (đơn khách tự đặt qua chatbot, đang chờ xác nhận) thì xác nhận đúng đơn đó, sửa lại nếu khách đổi ý;
   * không thì tạo đơn mới. Không tạo đơn thứ hai cho cùng một booking, tránh tính doanh thu hai lần.
   */
  async close(user: AuthUser, id: string, dto: CloseInput) {
    const c = await this.lay(id);
    // Chốt tour bắt buộc có số điện thoại để liên hệ khách (khách Zalo không tự có số, sale hỏi rồi nhập ở menu ⋯).
    if (!c.customer.phone) throw new BadRequestException({ code: 'NEED_PHONE', message: 'Khách chưa có số điện thoại. Bạn cập nhật số điện thoại của khách (menu ⋯ trong khung chat) trước khi chốt tour.' });
    if (dto.orderCode) {
      const trung = await this.prisma.deal.findUnique({ where: { orderCode: dto.orderCode }, select: { id: true } });
      if (trung && trung.id !== dto.dealId) throw new ConflictException('Mã đơn này đã được ghi nhận');
    }
    if (dto.dealId) {
      const don = await this.prisma.deal.findFirst({ where: { id: dto.dealId, conversationId: id }, select: { status: true } });
      if (!don) throw new NotFoundException('Không tìm thấy đơn này');
      if (don.status !== 'PENDING') throw new ConflictException(don.status === 'CONFIRMED' ? 'Đơn này đã được chốt' : 'Đơn này đã huỷ');
    }
    const gia = await this.pricing.bao({ ...dto, conversationId: id });
    if (gia.voucherError) throw new BadRequestException(gia.voucherError);
    const tourCode = gia.dayCode;
    const data = {
      tourName: gia.tourName, tourCode, tourKey: gia.tourKey, guests: gia.guests,
      departureDate: gia.departureDate ? new Date(`${gia.departureDate}T00:00:00Z`) : null,
      unitPrice: BigInt(gia.unitPrice), subtotal: BigInt(gia.subtotal), discount: BigInt(gia.discount), amount: BigInt(gia.total),
      voucherId: gia.voucher?.id ?? null, voucherCode: gia.voucher?.code ?? null,
      status: 'CONFIRMED' as const, closedById: user.id, closedAt: new Date(),
    };
    const tien = gia.total.toLocaleString('vi-VN');
    const voucherLog = gia.voucher ? `, voucher ${gia.voucher.code} giảm ${gia.discount.toLocaleString('vi-VN')} đ` : '';
    await this.prisma.$transaction(async (tx) => {
      if (gia.voucher) {
        // Hai sale cùng dùng voucher sắp hết lượt: khoá theo voucher rồi đếm lại.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'voucher:' + gia.voucher.id}))`;
        const v = await tx.voucher.findUnique({ where: { id: gia.voucher.id }, select: { maxUses: true } });
        if (v?.maxUses !== null && v?.maxUses !== undefined && (await this.pricing.daDung(gia.voucher.id, tx, dto.dealId)) >= v.maxUses) {
          throw new ConflictException('Voucher này vừa dùng hết lượt');
        }
      }
      if (dto.dealId) await tx.deal.update({ where: { id: dto.dealId }, data: { ...data, ...(dto.orderCode ? { orderCode: dto.orderCode } : {}) } });
      else await tx.deal.create({ data: { ...data, conversationId: id, customerId: c.customerId, channel: c.channel, source: 'STAFF', orderCode: dto.orderCode } });
    });
    const log = dto.dealId
      ? `${user.fullName} xác nhận đơn khách đặt qua bttAI: ${data.tourName} (${tourCode}), ${gia.guests} khách${voucherLog}, còn ${tien} đ`
      : `${user.fullName} chốt tour ${data.tourName} (${tourCode}), ${gia.guests} khách${voucherLog}, còn ${tien} đ`;
    return this.capNhat(user, id, { status: 'CLOSED' }, log);
  }

  /** Tìm đơn theo mã đơn trong hội thoại này (đơn khách đặt qua chatbot có mã booking). */
  async dealByOrder(id: string, code: string) {
    const d = await this.prisma.deal.findFirst({
      where: { conversationId: id, orderCode: { equals: code.trim(), mode: 'insensitive' } },
      select: { id: true, orderCode: true, tourCode: true, tourKey: true, tourName: true, guests: true, amount: true, status: true, voidedAt: true, createdAt: true },
    });
    if (!d) throw new NotFoundException('Không tìm thấy đơn có mã này trong hội thoại');
    return { ...d, amount: Number(d.amount) };
  }

  /** Khách báo không đi nữa: đơn chờ xác nhận chuyển sang huỷ, không tính doanh thu. */
  async cancelDeal(user: AuthUser, id: string, dealId: string, lyDo?: string) {
    const don = await this.prisma.deal.findFirst({ where: { id: dealId, conversationId: id } });
    if (!don) throw new NotFoundException('Không tìm thấy đơn này');
    if (don.status !== 'PENDING') throw new ConflictException('Chỉ huỷ được đơn đang chờ xác nhận');
    await this.prisma.deal.update({ where: { id: dealId }, data: { status: 'CANCELLED' } });
    const c = await this.lay(id);
    const conLai = await this.prisma.deal.count({ where: { conversationId: id, status: { in: ['PENDING', 'CONFIRMED'] }, voidedAt: null } });
    return this.capNhat(
      user,
      id,
      c.status === 'CLOSED' && !conLai ? { status: 'READ' } : {},
      `${user.fullName} huỷ đơn ${don.tourName}${lyDo?.trim() ? `: ${lyDo.trim()}` : ''}`,
    );
  }

  async patch(user: AuthUser, id: string, dto: PatchInput) {
    const c = await this.lay(id);
    const { followUpAt, followUpNote, ...rest } = dto;
    const data: Prisma.ConversationUncheckedUpdateInput = { ...rest };
    let log: string | undefined;
    if (followUpAt !== undefined) {
      if (followUpAt === null) {
        Object.assign(data, { followUpAt: null, followUpNote: null, followUpById: null, followUpNotifiedAt: null });
        if (c.followUpAt) log = `${user.fullName} bỏ hẹn nhắc`;
      } else {
        const luc = new Date(followUpAt);
        if (Number.isNaN(luc.getTime())) throw new BadRequestException('Giờ hẹn không hợp lệ');
        const note = followUpNote?.trim() || null;
        Object.assign(data, { followUpAt: luc, followUpNote: note, followUpById: user.id, followUpNotifiedAt: null });
        const phan = Object.fromEntries(
          new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', hourCycle: 'h23' }).formatToParts(luc).map((x) => [x.type, x.value]),
        );
        const gio = `${phan.hour}:${phan.minute} ngày ${phan.day}/${phan.month}`;
        log = `${user.fullName} hẹn nhắc lúc ${gio}${note ? `: ${note}` : ''}`;
      }
    }
    return this.capNhat(user, id, data, log);
  }

  /** Mỗi phút: đến giờ hẹn thì nhắc người hẹn (thông báo trên trang) và ghi log. */
  @Cron('0 * * * * *')
  async nhacHen() {
    const den = await this.prisma.conversation.findMany({
      where: { followUpAt: { lte: new Date() }, followUpNotifiedAt: null },
      select: { id: true, followUpNote: true, followUpById: true, customer: { select: { name: true } } },
      take: 100,
    });
    for (const c of den) {
      try {
        const r = await this.prisma.conversation.updateMany({ where: { id: c.id, followUpNotifiedAt: null }, data: { followUpNotifiedAt: new Date() } });
        if (!r.count) continue;
        const m = await this.ghiLog(c.id, `Đến hẹn nhắc${c.followUpNote ? `: ${c.followUpNote}` : ''}`);
        this.realtime.emit('message:new', { conversationId: c.id, message: this.ra(m) });
        this.realtime.emit('conversation:update', { id: c.id });
        this.realtime.emit('followup:due', { id: c.id, toUserId: c.followUpById, name: c.customer.name, note: c.followUpNote });
      } catch (e) {
        this.log.warn(`Nhắc hẹn ${c.id} lỗi: ${(e as Error).message}`);
      }
    }
  }

  async customers(user: AuthUser, search?: string, take = 200) {
    const pham = this.pham(user);
    const coPham = Object.keys(pham).length > 0;
    return this.prisma.customer.findMany({
      where: { ...(timKhach(search) ?? {}), ...(coPham ? { conversations: { some: pham } } : {}) },
      include: {
        conversations: {
          where: pham,
          orderBy: { lastMessageAt: 'desc' },
          select: { id: true, channel: true, status: true, interest: true, lastMessageAt: true, assignee: { select: { fullName: true } } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(take, 500),
    });
  }

  /** Lịch sử đơn của khách ở mọi kênh, mới nhất trước. */
  async customerDeals(user: AuthUser, customerId: string) {
    const pham = this.pham(user);
    const rows = await this.prisma.deal.findMany({
      where: { customerId, ...(Object.keys(pham).length ? { conversation: pham } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        conversationId: true,
        channel: true,
        status: true,
        source: true,
        orderCode: true,
        tourCode: true,
        tourName: true,
        guests: true,
        amount: true,
        unitPrice: true,
        subtotal: true,
        discount: true,
        voucherCode: true,
        departureDate: true,
        bookingStatus: true,
        createdAt: true,
        closedAt: true,
        voidedAt: true,
        closedBy: { select: { fullName: true } },
      },
    });
    const so = (v: bigint | null) => (v === null ? null : Number(v));
    return rows.map((d) => ({ ...d, amount: Number(d.amount), unitPrice: so(d.unitPrice), subtotal: so(d.subtotal), discount: so(d.discount) }));
  }

  /** Tìm trong nội dung tin, không phân biệt dấu. Biểu thức WHERE phải giống chỉ mục messages_text_fts_idx (migration sale_workflow). */
  async searchMessages(user: AuthUser, q: string, take = 50, conversationId?: string) {
    const tsq = truyVanTin(q);
    if (!tsq) return [];
    const pham = conversationId
      ? Prisma.sql`${sqlPhamHoiThoai(user.role === Role.DEPT_ADMIN ? phamViPhong(user) : null)} AND m."conversationId" = ${conversationId} AND m.internal = false`
      : sqlPhamHoiThoai(user.role === Role.DEPT_ADMIN ? phamViPhong(user) : null);
    return this.prisma.$queryRaw<{ id: string; conversationId: string; senderType: string; text: string; internal: boolean; createdAt: Date; channel: Channel; name: string; phone: string | null }[]>`
      SELECT m.id, m."conversationId", m."senderType", m.text, m.internal, m."createdAt", c.channel, cu.name, cu.phone
      FROM messages m
      JOIN conversations c ON c.id = m."conversationId"
      JOIN customers cu ON cu.id = c."customerId"
      WHERE to_tsvector('simple'::regconfig, btt_bo_dau(m.text)) @@ to_tsquery('simple'::regconfig, ${tsq}) AND ${pham}
      ORDER BY m."createdAt" DESC
      LIMIT ${Math.min(take, 200)}`;
  }

  /**
   * Chỉ ADMIN (controller kiểm tra). Xoá hẳn hội thoại cùng tin nhắn, đơn, nhãn tour; file đính kèm xoá khỏi nơi lưu.
   * Khách không còn hội thoại nào khác thì xoá luôn khách (và mã nhận diện), để tin nhắn mới tạo khách mới sạch.
   * Hội thoại có đơn ĐÃ CHỐT (đang tính doanh thu) thì phải gửi `force`, vì xoá sẽ làm doanh thu thống kê giảm.
   */
  async xoaHoiThoai(user: AuthUser, id: string, force: boolean) {
    const c = await this.prisma.conversation.findUnique({ where: { id }, select: { id: true, customerId: true, customer: { select: { name: true } } } });
    if (!c) throw new NotFoundException('Không tìm thấy hội thoại');
    const donChot = await this.prisma.deal.aggregate({ where: { conversationId: id, status: 'CONFIRMED', voidedAt: null }, _count: { _all: true }, _sum: { amount: true } });
    if (donChot._count._all > 0 && !force) {
      throw new ConflictException({ code: 'HAS_DEALS', count: donChot._count._all, amount: Number(donChot._sum.amount ?? 0), message: `Hội thoại có ${donChot._count._all} đơn đã chốt, xoá sẽ làm doanh thu thống kê giảm.` });
    }
    const files = await this.prisma.message.findMany({ where: { conversationId: id, attachmentPath: { not: null } }, select: { attachmentPath: true } });
    const xoaKhach = await this.prisma.$transaction(async (tx) => {
      await tx.conversation.delete({ where: { id } });
      const con = await tx.conversation.count({ where: { customerId: c.customerId } });
      if (con === 0) {
        await tx.customer.delete({ where: { id: c.customerId } });
        return true;
      }
      return false;
    });
    for (const f of files) if (f.attachmentPath) await this.tep.xoaTep(f.attachmentPath);
    this.log.warn(`${user.fullName} (${user.id}) xoá hội thoại ${id} của khách "${c.customer.name}"${xoaKhach ? ', đã xoá luôn khách' : ''}, ${files.length} file`);
    this.realtime.emit('conversation:update', { id });
    return { ok: true, deleted: id, customerDeleted: xoaKhach };
  }

  /** Sale xin được số của khách thì nhập ở đây. Số đã thuộc khách khác thì từ chối (không tự gộp hai khách). */
  async capNhatSoDienThoai(user: AuthUser, id: string, raw: string) {
    const c = await this.lay(id);
    const phone = chuanHoaSoDienThoai(raw ?? '');
    if (!phone) throw new BadRequestException('Số điện thoại không hợp lệ, cần 10 chữ số bắt đầu bằng 0 (hoặc +84)');
    const trung = await this.prisma.customer.findUnique({ where: { phone }, select: { id: true, name: true } });
    if (trung && trung.id !== c.customerId) throw new ConflictException(`Số này đã thuộc khách "${trung.name}". Nhờ quản trị viên gộp hai khách nếu là cùng một người.`);
    if (c.customer.phone === phone) return this.get(user, id);
    await this.prisma.$transaction([
      this.prisma.customer.update({ where: { id: c.customerId }, data: { phone, phoneVerified: false } }),
      this.prisma.message.create({ data: { conversationId: id, senderType: 'SYSTEM', internal: true, text: `${user.fullName} cập nhật số điện thoại của khách: ${phone}` } }),
    ]);
    this.realtime.emit('conversation:update', { id });
    return this.get(user, id);
  }
}
