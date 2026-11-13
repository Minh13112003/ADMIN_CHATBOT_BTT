import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Channel, Prisma } from '../generated/prisma/client';
import { chonQuyTac, ngoaiGioLamViec, RuleInput } from '../common/auto-reply';
import { chuanHoaMaTour, laCapNhatBookingCu, trangThaiTheoBooking } from '../common/deals';
import { chuanHoaSoDienThoai, cungMotNguoi, doiGapNhanVien, gopTen, tomTat } from '../common/text';
import { AssignmentService } from '../conversations/assignment.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService, HAN_LINK_KHACH_GIAY, TepDaLuu } from '../storage/attachments.service';
import { tomTatDinhKem } from '../common/attachments';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { BookingStatusDto, BotReplyDto, DealDto, HistoryDto, IdentifyDto, InboundDto, UsageDto } from './ingest.dto';

export const DA_BAO_NHAN_VIEN = 'Mình đã báo nhân viên. Nhân viên sẽ phản hồi bạn ngay trong khung chat này nhé.';
export const TEN_KHONG_KHOP = 'Số điện thoại này đã được dùng với một tên khác. Bạn vui lòng nhập lại họ tên và số điện thoại giúp mình nhé.';
const OFF_HOURS_LAP_LAI_MS = 12 * 3600_000;

type InboundResult = {
  conversationId: string;
  /** BOT: chatbot tự trả lời. AUTO_REPLY và CONTACT: gửi `reply` cho khách. STAFF: nhân viên đang xử lý, chatbot im lặng. */
  action: 'BOT' | 'AUTO_REPLY' | 'CONTACT' | 'STAFF';
  reply?: string;
  duplicate?: boolean;
};

@Injectable()
export class IngestService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private realtime: RealtimeGateway,
    private assignment: AssignmentService,
    private tep: AttachmentsService,
  ) {}

  /**
   * Web không đăng nhập: khách nhập tên và số trước khi chat.
   * Cùng số, tên khớp (Hoa, Nguyễn Hoa, Nguyễn Thị Hoa) thì nối vào hội thoại cũ. Tên khác hẳn thì từ chối.
   * `loadHistory` chỉ true khi đúng thiết bị cũ: máy khác nhập trùng số không được đọc tin cũ của khách.
   */
  async identify(dto: IdentifyDto) {
    const phone = chuanHoaSoDienThoai(dto.phone);
    if (!phone) throw new BadRequestException({ code: 'INVALID_PHONE', message: 'Số điện thoại chưa đúng, bạn kiểm tra lại giúp mình nhé.' });
    const ten = dto.name.trim().replace(/\s+/g, ' ');

    const identity = await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel: dto.channel, externalId: dto.externalUserId } } });
    const theoSo = await this.prisma.customer.findUnique({ where: { phone } });

    if (theoSo && !cungMotNguoi(theoSo.name, ten) && !theoSo.aliases.some((a) => cungMotNguoi(a, ten))) {
      throw new ConflictException({ code: 'NAME_MISMATCH', message: TEN_KHONG_KHOP });
    }

    const { customerId, returning } = await this.prisma.$transaction(async (tx) => {
      let customerId: string;
      if (theoSo) {
        const gop = gopTen(theoSo.name, theoSo.aliases, ten);
        await tx.customer.update({ where: { id: theoSo.id }, data: gop });
        customerId = theoSo.id;
      } else {
        customerId = (await tx.customer.create({ data: { name: ten, phone } })).id;
      }
      await tx.customerIdentity.upsert({
        where: { channel_externalId: { channel: dto.channel, externalId: dto.externalUserId } },
        create: { channel: dto.channel, externalId: dto.externalUserId, customerId },
        update: { customerId },
      });
      return { customerId, returning: !!theoSo };
    });

    const conv = await this.layHoacTaoHoiThoai(this.prisma, customerId, dto.channel);
    if (returning && identity?.customerId !== customerId) {
      const m = await this.prisma.message.create({
        data: { conversationId: conv.id, senderType: 'SYSTEM', internal: true, text: `Khách quay lại từ thiết bị khác, nhập tên "${ten}" cùng số cũ. Phía khách không hiện tin cũ` },
      });
      this.realtime.emit('message:new', { conversationId: conv.id, message: m });
    }
    this.realtime.emit('conversation:update', { id: conv.id });
    return { conversationId: conv.id, returning, loadHistory: identity?.customerId === customerId };
  }

  private async layHoacTaoHoiThoai(tx: Prisma.TransactionClient, customerId: string, channel: Channel) {
    return tx.conversation.upsert({
      where: { customerId_channel: { customerId, channel } },
      create: { customerId, channel },
      update: {},
    });
  }

  /** App đã đăng nhập: tự có tên và số từ tài khoản. Trùng số với khách đã có thì gộp về một khách. */
  private async timKhach(tx: Prisma.TransactionClient, dto: Pick<InboundDto, 'channel' | 'externalUserId' | 'customer'>) {
    const key = { channel: dto.channel, externalId: dto.externalUserId };
    const identity = await tx.customerIdentity.findUnique({ where: { channel_externalId: key } });
    const phone = dto.customer?.phone ? chuanHoaSoDienThoai(dto.customer.phone) : null;
    const ten = dto.customer?.name?.trim();
    const verified = dto.channel === 'APP';

    if (identity) {
      if (verified && (phone || ten)) {
        const hienTai = await tx.customer.findUniqueOrThrow({ where: { id: identity.customerId } });
        const gop = ten ? gopTen(hienTai.name, hienTai.aliases, ten) : {};
        const trung = phone && phone !== hienTai.phone ? await tx.customer.findUnique({ where: { phone } }) : null;
        await tx.customer.update({
          where: { id: identity.customerId },
          data: { ...gop, ...(phone && !trung ? { phone, phoneVerified: true } : {}) },
        });
      }
      return identity.customerId;
    }

    const theoSo = phone ? await tx.customer.findUnique({ where: { phone } }) : null;
    const customerId = theoSo
      ? theoSo.id
      : (await tx.customer.create({ data: { name: ten || 'Khách chưa rõ tên', phone, phoneVerified: verified && !!phone } })).id;
    await tx.customerIdentity.create({ data: { ...key, customerId } });
    return customerId;
  }

  /** `file`: khách gửi kèm ảnh hoặc PDF (đã qua kiểm tra và đã lưu ở Storage). Tin có thể không có chữ. */
  async inbound(dto: InboundDto, file?: TepDaLuu, phu?: { replyToId?: string }): Promise<InboundResult> {
    if (dto.externalMessageId) {
      const cu = await this.prisma.message.findUnique({ where: { externalMessageId: dto.externalMessageId } });
      if (cu) return { conversationId: cu.conversationId, action: 'BOT', duplicate: true };
    }
    const canNguoi = !!dto.wantsHuman || doiGapNhanVien(dto.text);
    const now = new Date();
    const rules = (await this.prisma.autoReplyRule.findMany({ where: { enabled: true } })) as RuleInput[];

    const ketQua = await this.prisma.$transaction(async (tx) => {
      const customerId = await this.timKhach(tx, dto);
      const truoc = await this.layHoacTaoHoiThoai(tx, customerId, dto.channel);
      // Cột do trigger điền khi có tin của khách: null nghĩa là đây là tin đầu tiên. Không đếm bảng tin nhắn.
      const tinDauTien = truoc.lastCustomerMessageAt === null;
      const thongBao: Prisma.MessageCreateManyInput[] = [];

      const khachTin = await tx.message.create({
        // Đặt giờ tường minh để câu của khách luôn đứng trước log và câu trả lời tạo ngay sau đó.
        data: { conversationId: truoc.id, senderType: 'CUSTOMER', text: dto.text, isTrigger: canNguoi, externalMessageId: dto.externalMessageId, createdAt: now, ...(phu?.replyToId ? { replyToId: phu.replyToId } : {}), ...(file ? { attachmentPath: file.path, attachmentType: file.type, attachmentName: file.name, attachmentSize: file.size } : {}) },
      });
      const data: Prisma.ConversationUncheckedUpdateInput = {
        lastMessageAt: now,
        lastMessagePreview: tomTat(file ? tomTatDinhKem(dto.text, file.type, file.name) : dto.text),
        ...(dto.interest ? { interest: dto.interest } : {}),
      };

      let action: InboundResult['action'] = 'BOT';
      let reply: string | undefined;
      let nguoi: { id: string; fullName: string } | null = null;
      let vuaLienHe = false;

      if (truoc.mode === 'STAFF') {
        action = 'STAFF';
        // Đang xử lý mà khách lại đòi gặp: giữ nguyên người, không chia lại, nhưng báo lên đầu danh sách.
        if (canNguoi) {
          data.status = 'CONTACT';
          data.contactRequestedAt = now;
          vuaLienHe = true;
        } else if (truoc.status === 'READ' || truoc.status === 'CLOSED') data.status = 'PENDING';
      } else if (canNguoi) {
        action = 'CONTACT';
        reply = DA_BAO_NHAN_VIEN;
        vuaLienHe = true;
        nguoi = truoc.status === 'CONTACT' && truoc.assigneeId ? null : await this.assignment.chia(tx, truoc.lastHandlerId);
        data.status = 'CONTACT';
        data.contactRequestedAt = now;
        if (nguoi) {
          data.assigneeId = nguoi.id;
          data.lastHandlerId = nguoi.id;
          data.contactAssignedAt = now;
        }
        const ai = nguoi ? `Hệ thống chia cho ${nguoi.fullName}` : truoc.assigneeId ? 'Khách nhắc lại yêu cầu' : 'Chưa có ai đang trực để chia';
        thongBao.push({ conversationId: truoc.id, senderType: 'SYSTEM', internal: true, text: `Khách yêu cầu gặp nhân viên, chuyển sang Liên hệ. ${ai}` });
        thongBao.push({ conversationId: truoc.id, senderType: 'BOT', text: DA_BAO_NHAN_VIEN });
      } else {
        if (truoc.status === 'READ' || truoc.status === 'CLOSED') data.status = 'UNREAD';
        if (truoc.autoReplyOn) {
          const ganDay = await tx.message.findMany({
            where: { conversationId: truoc.id, senderType: 'AUTO', createdAt: { gte: new Date(now.getTime() - OFF_HOURS_LAP_LAI_MS) } },
            select: { ruleName: true },
          });
          const r = chonQuyTac(rules, {
            channel: dto.channel,
            text: dto.text,
            isFirstMessage: tinDauTien,
            isOffHours: ngoaiGioLamViec(now, Number(this.config.get('WORK_HOUR_START') ?? 8), Number(this.config.get('WORK_HOUR_END') ?? 17.5)),
            recentRuleNames: ganDay.map((m) => m.ruleName).filter((x): x is string => !!x),
          });
          if (r) {
            action = 'AUTO_REPLY';
            reply = r.body;
            thongBao.push({ conversationId: truoc.id, senderType: 'AUTO', ruleName: r.name, text: r.body });
            await tx.autoReplyRule.update({ where: { id: r.id }, data: { sentCount: { increment: 1 } } });
          }
        }
      }

      if (reply) {
        data.lastMessageAt = new Date(now.getTime() + 1);
        data.lastMessagePreview = tomTat(reply);
      }
      const sau = await tx.conversation.update({ where: { id: truoc.id }, data, include: { customer: { select: { name: true } }, assignee: { select: { fullName: true } } } });

      const them = [];
      for (const [i, t] of thongBao.entries()) {
        them.push(await tx.message.create({ data: { ...t, createdAt: new Date(now.getTime() + i + 1) } }));
      }
      return { sau, khachTin, them, action, reply, vuaLienHe };
    });

    const id = ketQua.sau.id;
    for (const m of [ketQua.khachTin, ...ketQua.them]) this.realtime.emit('message:new', { conversationId: id, message: this.raNgoai(m) });
    this.realtime.emit('conversation:update', { id });
    if (ketQua.vuaLienHe) {
      this.realtime.emit('contact:new', { id, name: ketQua.sau.customer.name, channel: ketQua.sau.channel, assignee: ketQua.sau.assignee?.fullName ?? null });
    }
    return { conversationId: id, action: ketQua.action, reply: ketQua.reply };
  }

  /**
   * Nhân viên trả lời ngay trên ứng dụng Zalo OA (webhook oa_send_*): ghi vào hội thoại như tin nhân viên, nhãn "Zalo OA".
   * Không gửi lại sang Zalo, không chạy quy tắc tự động. Tin vừa gửi từ chính trang này cũng được Zalo báo lại nên bỏ qua
   * nếu cùng nội dung đã có trong 2 phút gần nhất. Khách chưa có trong hệ thống thì bỏ qua (tin cũ sẽ được kéo về khi khách nhắn).
   */
  async oaGui(a: { userId: string; text: string; msgId: string | null; file?: TepDaLuu; trichMa?: string | null }): Promise<{ saved: boolean }> {
    const ma = a.msgId ? `zalo:${a.msgId}` : undefined;
    if (ma && (await this.daCoTin(ma))) return { saved: false };
    const dt = await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel: 'ZALO', externalId: a.userId } }, select: { customerId: true } });
    if (!dt) return { saved: false };
    const conv = await this.layHoacTaoHoiThoai(this.prisma, dt.customerId, 'ZALO');
    const now = new Date();
    const trung = await this.prisma.message.findFirst({
      where: { conversationId: conv.id, internal: false, senderType: { in: ['STAFF', 'AUTO', 'BOT'] }, text: a.text, createdAt: { gte: new Date(now.getTime() - 2 * 60_000) } },
      select: { id: true },
    });
    if (trung) return { saved: false };
    const goc = a.trichMa ? await this.prisma.message.findFirst({ where: { externalMessageId: `zalo:${a.trichMa}`, conversationId: conv.id }, select: { id: true } }) : null;
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId: conv.id, senderType: 'STAFF', staffLabel: 'Zalo OA', text: a.text, externalMessageId: ma, createdAt: now, ...(goc ? { replyToId: goc.id } : {}), ...(a.file ? { attachmentPath: a.file.path, attachmentType: a.file.type, attachmentName: a.file.name, attachmentSize: a.file.size } : {}) },
      }),
      this.prisma.conversation.update({
        where: { id: conv.id },
        data: {
          lastMessageAt: now,
          lastMessagePreview: tomTat(a.file ? tomTatDinhKem(a.text, a.file.type, a.file.name) : a.text),
          // Có người đã trả lời: Liên hệ thành Chờ xử lý, Chưa xem thành Đã xem.
          ...(conv.status === 'CONTACT' ? { status: 'PENDING' as const } : conv.status === 'UNREAD' ? { status: 'READ' as const } : {}),
        },
      }),
    ]);
    this.realtime.emit('message:new', { conversationId: conv.id, message: this.raNgoai(message) });
    this.realtime.emit('conversation:update', { id: conv.id });
    return { saved: true };
  }

  /** Khách thả cảm xúc vào một tin: ghi dòng nhật ký nội bộ (chỉ nhân viên thấy), không đổi trạng thái hay xem trước của danh sách. */
  async khachThaCamXuc(a: { userId: string; msgId: string | null; camXuc: string }): Promise<{ saved: boolean }> {
    const dt = await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel: 'ZALO', externalId: a.userId } }, select: { customerId: true } });
    if (!dt) return { saved: false };
    const conv = await this.prisma.conversation.findUnique({ where: { customerId_channel: { customerId: dt.customerId, channel: 'ZALO' } }, select: { id: true } });
    if (!conv) return { saved: false };
    const goc = a.msgId ? await this.prisma.message.findUnique({ where: { externalMessageId: `zalo:${a.msgId}` }, select: { text: true } }) : null;
    const message = await this.prisma.message.create({
      data: { conversationId: conv.id, senderType: 'SYSTEM', internal: true, text: `Khách ${a.camXuc}${goc ? ` vào tin: "${tomTat(goc.text).slice(0, 60)}"` : ' vào một tin nhắn'}` },
    });
    this.realtime.emit('message:new', { conversationId: conv.id, message: this.raNgoai(message) });
    return { saved: true };
  }

  async daCoTin(externalMessageId: string) {
    return !!(await this.prisma.message.findUnique({ where: { externalMessageId }, select: { id: true } }));
  }

  /** Bỏ đường dẫn lưu trữ khỏi tin phát qua socket, thay bằng `attachment` có link xem. */
  private raNgoai<T extends { id: string; attachmentPath?: string | null; attachmentType?: string | null; attachmentName?: string | null; attachmentSize?: number | null }>(m: T) {
    const { attachmentPath = null, attachmentType = null, attachmentName = null, attachmentSize = null, ...con } = m;
    return { ...con, attachment: this.tep.dinhKem({ id: m.id, attachmentPath, attachmentType, attachmentName, attachmentSize }) };
  }

  private async hoiThoaiCua(channel: Channel, externalUserId: string) {
    const identity = await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel, externalId: externalUserId } } });
    if (!identity) throw new NotFoundException('Chưa có khách này, gọi inbound trước');
    return this.layHoacTaoHoiThoai(this.prisma, identity.customerId, channel);
  }

  async botReply(dto: BotReplyDto) {
    if (dto.externalMessageId) {
      const cu = await this.prisma.message.findUnique({ where: { externalMessageId: dto.externalMessageId } });
      if (cu) return { messageId: cu.id, duplicate: true };
    }
    const conv = await this.hoiThoaiCua(dto.channel, dto.externalUserId);
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: conv.id,
          senderType: 'BOT',
          text: dto.text,
          tours: dto.tours?.length ? (dto.tours as Prisma.InputJsonValue) : undefined,
          externalMessageId: dto.externalMessageId,
        },
      }),
      this.prisma.conversation.update({ where: { id: conv.id }, data: { lastMessageAt: new Date(), lastMessagePreview: tomTat(dto.text) } }),
      ...(dto.model && (dto.inputTokens || dto.outputTokens)
        ? [this.prisma.aiUsage.create({ data: { conversationId: conv.id, model: dto.model, inputTokens: dto.inputTokens ?? 0, outputTokens: dto.outputTokens ?? 0 } })]
        : []),
    ]);
    this.realtime.emit('message:new', { conversationId: conv.id, message });
    this.realtime.emit('conversation:update', { id: conv.id });
    return { messageId: message.id };
  }

  /** Chỉ ghi lại, không chạy quy tắc nào. Trùng `externalMessageId` thì bỏ qua để chatbot gửi lại không tạo tin đôi. */
  async history(dto: HistoryDto) {
    const { id, moi } = await this.prisma.$transaction(async (tx) => {
      const customerId = await this.timKhach(tx, dto);
      const conv = await this.layHoacTaoHoiThoai(tx, customerId, dto.channel);
      const moi = [];
      for (const m of dto.messages) {
        if (await tx.message.findUnique({ where: { externalMessageId: m.externalMessageId } })) continue;
        moi.push(await tx.message.create({ data: { conversationId: conv.id, senderType: m.senderType, text: m.text, externalMessageId: m.externalMessageId, createdAt: new Date(m.createdAt) } }));
      }
      const cuoi = moi[moi.length - 1];
      if (cuoi) {
        const khachNhan = moi.some((m) => m.senderType === 'CUSTOMER') && (conv.status === 'READ' || conv.status === 'CLOSED');
        await tx.conversation.update({
          where: { id: conv.id },
          data: {
            lastMessageAt: cuoi.createdAt > conv.lastMessageAt ? cuoi.createdAt : conv.lastMessageAt,
            lastMessagePreview: tomTat(cuoi.text),
            ...(khachNhan ? { status: conv.mode === 'STAFF' ? ('PENDING' as const) : ('UNREAD' as const) } : {}),
          },
        });
      }
      return { id: conv.id, moi };
    });
    for (const m of moi) this.realtime.emit('message:new', { conversationId: id, message: m });
    if (moi.length) this.realtime.emit('conversation:update', { id });
    return { saved: moi.length };
  }

  async usage(dto: UsageDto) {
    await this.prisma.aiUsage.create({ data: dto });
  }

  /**
   * Khách tự đặt tour qua chatbot. Đơn ở trạng thái chờ xác nhận, chưa tính doanh thu: sale gọi khách rồi bấm xác nhận,
   * hoặc BE Mobile báo đã thanh toán (bookingStatus). Hội thoại chuyển Chờ xử lý và được chia cho một sale nếu chưa có ai.
   */
  async deal(dto: DealDto) {
    if (dto.orderCode && (await this.prisma.deal.findUnique({ where: { orderCode: dto.orderCode } }))) return { duplicate: true };
    const conv = await this.hoiThoaiCua(dto.channel, dto.externalUserId);
    const tien = dto.amount.toLocaleString('vi-VN');
    const tourCode = chuanHoaMaTour(dto.tourCode);
    const ketQua = await this.prisma.$transaction(async (tx) => {
      await tx.deal.create({
        data: {
          conversationId: conv.id,
          customerId: conv.customerId,
          channel: dto.channel,
          orderCode: dto.orderCode,
          tourCode,
          tourName: dto.tourName,
          guests: dto.guests,
          amount: BigInt(dto.amount),
          status: 'PENDING',
          source: 'CHATBOT',
        },
      });
      const nguoi = conv.assigneeId ? null : await this.assignment.chia(tx, conv.lastHandlerId);
      const sau = await tx.conversation.update({
        where: { id: conv.id },
        data: {
          ...(conv.status === 'CONTACT' ? {} : { status: 'PENDING' as const }),
          ...(nguoi ? { assigneeId: nguoi.id, lastHandlerId: nguoi.id } : {}),
        },
        include: { customer: { select: { name: true } }, assignee: { select: { fullName: true } } },
      });
      const ai = nguoi ? ` Hệ thống chia cho ${nguoi.fullName}.` : conv.assigneeId ? '' : ' Chưa có ai đang trực để chia.';
      const ma = [tourCode && `mã tour ${tourCode}`, dto.orderCode && `mã đơn ${dto.orderCode}`].filter(Boolean).join(', ');
      const log = await tx.message.create({
        data: {
          conversationId: conv.id,
          senderType: 'SYSTEM',
          internal: true,
          text: `Khách tự đặt ${dto.tourName} qua bttAI${ma ? ` (${ma})` : ''}, ${dto.guests} khách, ${tien} đ. Đơn chờ sale gọi xác nhận.${ai}`,
        },
      });
      return { sau, log };
    });
    this.realtime.emit('message:new', { conversationId: conv.id, message: ketQua.log });
    this.realtime.emit('conversation:update', { id: conv.id });
    this.realtime.emit('contact:new', { id: conv.id, name: ketQua.sau.customer.name, channel: ketQua.sau.channel, assignee: ketQua.sau.assignee?.fullName ?? null, kind: 'BOOKING' });
    return { ok: true };
  }

  /** BE Mobile báo booking đổi trạng thái: cập nhật đơn theo common/deals.ts trangThaiTheoBooking. Không biết mã thì bỏ qua. */
  async bookingStatus(dto: BookingStatusDto) {
    const don = await this.prisma.deal.findUnique({ where: { orderCode: dto.orderCode }, include: { conversation: { select: { status: true } } } });
    if (!don) return { matched: false };
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (laCapNhatBookingCu(don.bookingUpdatedAt, dto.occurredAt ? occurredAt : null)) return { matched: true, status: don.status };
    const moi = trangThaiTheoBooking(don.status, dto.status);
    const now = new Date();
    const NHAN: Record<string, string> = { PENDING: 'chờ xử lý', CONFIRMED: 'đã giữ chỗ', PAID: 'đã thanh toán', ONGOING: 'đang đi tour', COMPLETED: 'đã đi xong', CANCELLED: 'đã huỷ', REFUNDED: 'đã hoàn tiền' };
    const logs: string[] = [];
    let trangThaiHoiThoai: 'CLOSED' | 'READ' | undefined;
    if (moi === 'CONFIRMED') {
      logs.push(`Hệ thống đặt tour báo booking ${dto.orderCode} ${NHAN[dto.status]}: đơn ${don.tourName} được tính doanh thu`);
      trangThaiHoiThoai = 'CLOSED';
    } else if (moi === 'CANCELLED') {
      logs.push(`Hệ thống đặt tour báo booking ${dto.orderCode} ${NHAN[dto.status]}: đơn ${don.tourName} không còn tính doanh thu`);
      const conLai = await this.prisma.deal.count({ where: { conversationId: don.conversationId, id: { not: don.id }, status: 'CONFIRMED', voidedAt: null } });
      if (don.conversation.status === 'CLOSED' && !conLai) trangThaiHoiThoai = 'READ';
    } else if (don.bookingStatus !== dto.status) {
      logs.push(`Booking ${dto.orderCode} ${NHAN[dto.status]}`);
    }
    const tin = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.deal.updateMany({
        where: { id: don.id, ...(dto.occurredAt ? { OR: [{ bookingUpdatedAt: null }, { bookingUpdatedAt: { lt: occurredAt } }] } : {}) },
        data: { bookingStatus: dto.status, bookingUpdatedAt: occurredAt, ...(moi ? { status: moi } : {}), ...(moi === 'CONFIRMED' && don.status === 'PENDING' ? { closedAt: now } : {}) },
      });
      if (!changed.count) return [];
      if (trangThaiHoiThoai) await tx.conversation.update({ where: { id: don.conversationId }, data: { status: trangThaiHoiThoai } });
      const ra = [];
      for (const text of logs) ra.push(await tx.message.create({ data: { conversationId: don.conversationId, senderType: 'SYSTEM', internal: true, text } }));
      return ra;
    });
    for (const m of tin) this.realtime.emit('message:new', { conversationId: don.conversationId, message: m });
    this.realtime.emit('conversation:update', { id: don.conversationId });
    return { matched: true, status: moi ?? don.status };
  }

  /**
   * Tin nhân viên để chatbot giao cho khách. Không bao giờ trả log nội bộ.
   * Khung chat phía khách chỉ gọi khi đang mở, nên lần gọi được ghi là "khách đã xem" (customerSeenAt, tối đa 20 giây một lần).
   * Tin có trích thì thêm dòng trích ở đầu, vì app và web chưa có giao diện trích riêng.
   */
  async updates(channel: Channel, externalUserId: string, after?: string) {
    const identity = await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel, externalId: externalUserId } } });
    if (!identity) return { mode: 'BOT', items: [] };
    const conv = await this.prisma.conversation.findUnique({ where: { customerId_channel: { customerId: identity.customerId, channel } } });
    if (!conv) return { mode: 'BOT', items: [] };
    const moc = after ? new Date(after) : new Date();
    if (Number.isNaN(moc.getTime())) throw new BadRequestException('Mốc thời gian không hợp lệ');
    const rows = await this.prisma.message.findMany({
      where: { conversationId: conv.id, internal: false, senderType: 'STAFF', createdAt: { gt: moc } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, text: true, createdAt: true, attachmentPath: true, attachmentType: true, attachmentName: true, attachmentSize: true, replyTo: { select: { text: true } } },
      take: 50,
    });
    const now = new Date();
    if (conv.mode === 'STAFF' && (!conv.customerSeenAt || now.getTime() - conv.customerSeenAt.getTime() > 20_000)) {
      await this.prisma.conversation.update({ where: { id: conv.id }, data: { customerSeenAt: now } });
      this.realtime.emit('conversation:update', { id: conv.id });
    }
    const items = rows.map((m) => ({ id: m.id, createdAt: m.createdAt, text: m.replyTo ? `“${tomTat(m.replyTo.text, 80)}”\n${m.text}` : m.text, attachment: this.tep.dinhKem(m, HAN_LINK_KHACH_GIAY) }));
    return { mode: conv.mode, items };
  }
}
