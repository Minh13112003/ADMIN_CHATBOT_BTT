import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.decorators';
import { tomTatDinhKem } from '../common/attachments';
import { bieuCamSau, canhBaoXoa, laBieuCam, loiSuaTin, MA_ZALO, type BieuCam } from '../common/reactions';
import { tomTat } from '../common/text';
import { ZaloService } from '../channels/zalo.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ConversationsService } from './conversations.service';

/**
 * Thao tác trên từng tin (2026-11-26): thả biểu cảm, sửa, xoá (xoá mềm). Ai trong nhóm sale / admin cũng xoá được mọi tin
 * (chủ dự án chốt); chỉ người gửi sửa được tin của mình. Tin web/app: chatbot đọc `changedAt` để cập nhật phía khách.
 * Zalo / Facebook không cho trang sửa hay thu hồi tin, nên tin chỉ ẩn trong trang này.
 */
@Injectable()
export class MessageActionsService {
  private log = new Logger('MessageActions');
  constructor(private prisma: PrismaService, private realtime: RealtimeGateway, private convs: ConversationsService, private zalo: ZaloService) {}

  private async tin(conversationId: string, messageId: string) {
    const m = await this.prisma.message.findFirst({
      where: { id: messageId, conversationId, conversation: { isAvailable: true } },
      select: { id: true, senderType: true, staffId: true, internal: true, isAvailable: true, text: true, externalMessageId: true, createdAt: true, attachmentType: true, attachmentName: true, conversation: { select: { channel: true, customerId: true } } },
    });
    if (!m) throw new NotFoundException('Không tìm thấy tin nhắn');
    return m;
  }

  private async moiNhat(messageId: string) {
    const m = await this.prisma.message.findUniqueOrThrow({
      where: { id: messageId },
      select: {
        id: true, senderType: true, staffLabel: true, ruleName: true, text: true, internal: true, isTrigger: true, tours: true, createdAt: true,
        attachmentPath: true, attachmentType: true, attachmentName: true, attachmentSize: true, staffId: true, editedAt: true,
        replyTo: { select: { id: true, text: true, senderType: true, isAvailable: true } },
        reactions: { select: { emoji: true, actorKey: true, staff: { select: { fullName: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    return this.convs.ra(m);
  }

  /** Thả, đổi hoặc gỡ biểu cảm của mình. Kênh Zalo: gửi sang Zalo (lỗi thì vẫn lưu, trả `warning`). */
  async thaBieuCam(user: AuthUser, conversationId: string, messageId: string, chon: string | null) {
    if (chon !== null && !laBieuCam(chon)) throw new BadRequestException('Biểu cảm không hợp lệ');
    const m = await this.tin(conversationId, messageId);
    if (!m.isAvailable) throw new BadRequestException('Tin này đã bị xoá');
    if (m.internal || m.senderType === 'SYSTEM') throw new BadRequestException('Không thả biểu cảm vào dòng nhật ký nội bộ');
    const cu = await this.prisma.messageReaction.findUnique({ where: { messageId_actorKey: { messageId, actorKey: user.id } }, select: { emoji: true } });
    const sau = bieuCamSau(cu && laBieuCam(cu.emoji) ? cu.emoji : null, chon as BieuCam | null);
    const luc = new Date();
    await this.prisma.$transaction([
      sau
        ? this.prisma.messageReaction.upsert({ where: { messageId_actorKey: { messageId, actorKey: user.id } }, create: { messageId, actorKey: user.id, staffId: user.id, emoji: sau }, update: { emoji: sau, createdAt: luc } })
        : this.prisma.messageReaction.deleteMany({ where: { messageId, actorKey: user.id } }),
      this.prisma.message.update({ where: { id: messageId }, data: { changedAt: luc } }),
    ]);
    let warning: string | undefined;
    const maZalo = m.externalMessageId?.startsWith('zalo:') ? m.externalMessageId.slice(5).split(':')[0] : null;
    if (sau && m.conversation.channel === 'ZALO' && maZalo) {
      try {
        const dt = await this.prisma.customerIdentity.findFirst({ where: { customerId: m.conversation.customerId, channel: 'ZALO' }, select: { externalId: true } });
        if (dt) await this.zalo.thaCamXuc(dt.externalId, maZalo, MA_ZALO[sau]);
      } catch (e) {
        warning = `Đã lưu biểu cảm nhưng chưa gửi được sang Zalo: ${(e as Error).message}`;
        this.log.warn(warning);
      }
    } else if (sau && (m.conversation.channel === 'ZALO' || m.conversation.channel === 'FACEBOOK')) {
      warning = 'Biểu cảm chỉ hiện trong trang quản trị, chưa gửi được sang kênh của khách cho tin này.';
    }
    this.realtime.emit('message:update', { conversationId, messageId });
    return { emoji: sau, warning, message: await this.moiNhat(messageId) };
  }

  /** Sửa chữ của tin mình gửi (web, app). Zalo / Facebook bị chặn vì khách vẫn thấy tin cũ. */
  async sua(user: AuthUser, conversationId: string, messageId: string, text: string) {
    const noiDung = text.trim();
    if (!noiDung) throw new BadRequestException('Tin nhắn đang trống');
    const m = await this.tin(conversationId, messageId);
    const loi = loiSuaTin(m, user.id, m.conversation.channel);
    if (loi) throw new BadRequestException(loi);
    if (noiDung === m.text) return { message: await this.moiNhat(messageId) };
    const luc = new Date();
    await this.prisma.message.update({ where: { id: messageId }, data: { text: noiDung, editedAt: luc, changedAt: luc } });
    await this.capNhatXemTruoc(conversationId);
    this.realtime.emit('message:update', { conversationId, messageId });
    this.realtime.emit('conversation:update', { id: conversationId });
    return { message: await this.moiNhat(messageId) };
  }

  /** Xoá mềm một tin: ẩn khỏi khung chat và khỏi khung chat web/app của khách; admin toàn quyền khôi phục hoặc xoá hẳn ở tab Khôi phục. */
  async xoa(user: AuthUser, conversationId: string, messageId: string) {
    const m = await this.tin(conversationId, messageId);
    if (!m.isAvailable) throw new BadRequestException('Tin này đã bị xoá');
    const luc = new Date();
    await this.prisma.message.update({ where: { id: messageId }, data: { isAvailable: false, deletedAt: luc, deletedById: user.id, changedAt: luc } });
    await this.capNhatXemTruoc(conversationId);
    this.realtime.emit('message:update', { conversationId, messageId });
    this.realtime.emit('conversation:update', { id: conversationId });
    return { ok: true, text: m.text, warning: canhBaoXoa(m.conversation.channel, m.senderType, m.internal) ?? undefined };
  }

  /** Dòng xem trước ở danh sách hội thoại = tin (không phải log) mới nhất còn hiện. */
  async capNhatXemTruoc(conversationId: string) {
    const cuoi = await this.prisma.message.findFirst({
      where: { conversationId, internal: false, isAvailable: true },
      orderBy: { createdAt: 'desc' },
      select: { text: true, attachmentType: true, attachmentName: true },
    });
    const xem = cuoi ? tomTat(cuoi.attachmentType ? tomTatDinhKem(cuoi.text, cuoi.attachmentType, cuoi.attachmentName ?? '') : cuoi.text) : null;
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessagePreview: xem } });
  }
}
