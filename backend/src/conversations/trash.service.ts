import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthUser } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AttachmentsService } from '../storage/attachments.service';
import { ConversationsService } from './conversations.service';
import { MessageActionsService } from './message-actions.service';

const N = 50;

/**
 * Tab Khôi phục (2026-11-26, chỉ admin toàn quyền): hội thoại và tin đã xoá mềm. Khôi phục trả lại như cũ;
 * xoá hẳn mới xoá khỏi database (hội thoại có đơn đã chốt phải xác nhận thêm vì doanh thu thống kê giảm).
 */
@Injectable()
export class TrashService {
  private log = new Logger('Trash');
  constructor(private prisma: PrismaService, private realtime: RealtimeGateway, private tep: AttachmentsService, private convs: ConversationsService, private actions: MessageActionsService) {}

  private async tenNguoi(ids: (string | null)[]): Promise<Map<string, string>> {
    const ds = [...new Set(ids.filter((x): x is string => !!x))];
    if (!ds.length) return new Map();
    const rows = await this.prisma.user.findMany({ where: { id: { in: ds } }, select: { id: true, fullName: true } });
    return new Map(rows.map((r) => [r.id, r.fullName]));
  }

  private moc(before?: string) {
    if (!before) return undefined;
    const d = new Date(before);
    if (Number.isNaN(d.getTime())) throw new BadRequestException('Mốc không hợp lệ');
    return { lt: d };
  }

  async hoiThoai(before?: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { isAvailable: false, ...(before ? { deletedAt: this.moc(before) } : {}) },
      orderBy: { deletedAt: 'desc' },
      take: N + 1,
      select: {
        id: true, channel: true, status: true, deletedAt: true, deletedById: true, lastMessageAt: true, lastMessagePreview: true,
        customer: { select: { id: true, name: true, phone: true, avatarUrl: true } },
        _count: { select: { messages: true, deals: { where: { status: 'CONFIRMED', voidedAt: null } } } },
      },
    });
    const ten = await this.tenNguoi(rows.map((r) => r.deletedById));
    const items = rows.slice(0, N).map(({ _count, deletedById, ...r }) => ({ ...r, deletedBy: deletedById ? (ten.get(deletedById) ?? 'Tài khoản đã xoá') : null, messageCount: _count.messages, confirmedDeals: _count.deals }));
    return { items, nextBefore: rows.length > N ? items[items.length - 1].deletedAt?.toISOString() ?? null : null };
  }

  /** Xem trước nội dung một hội thoại đã xoá: 100 tin gần nhất (cả tin đã xoá lẻ trước đó), cũ trước mới sau. */
  async tinCuaHoiThoai(id: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id }, select: { isAvailable: true } });
    if (!c || c.isAvailable) throw new NotFoundException('Không tìm thấy hội thoại đã xoá');
    const rows = await this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, senderType: true, staffLabel: true, text: true, internal: true, createdAt: true, attachmentPath: true, attachmentType: true, attachmentName: true, attachmentSize: true },
    });
    return rows.reverse().map((m) => this.convs.ra(m));
  }

  /** Tin xoá lẻ trong hội thoại còn hiện (tin của hội thoại đã xoá nằm trong hội thoại đó). */
  async tin(before?: string) {
    const rows = await this.prisma.message.findMany({
      where: { isAvailable: false, conversation: { isAvailable: true }, ...(before ? { deletedAt: this.moc(before) } : {}) },
      orderBy: { deletedAt: 'desc' },
      take: N + 1,
      select: {
        id: true, senderType: true, staffLabel: true, text: true, internal: true, createdAt: true, deletedAt: true, deletedById: true, conversationId: true,
        attachmentPath: true, attachmentType: true, attachmentName: true, attachmentSize: true,
        conversation: { select: { channel: true, customer: { select: { name: true, phone: true } } } },
      },
    });
    const ten = await this.tenNguoi(rows.map((r) => r.deletedById));
    const items = rows.slice(0, N).map(({ deletedById, ...r }) => ({ ...this.convs.ra(r), deletedBy: deletedById ? (ten.get(deletedById) ?? 'Tài khoản đã xoá') : null }));
    return { items, nextBefore: rows.length > N ? items[items.length - 1].deletedAt?.toISOString() ?? null : null };
  }

  async khoiPhucHoiThoai(user: AuthUser, id: string) {
    const c = await this.prisma.conversation.findUnique({ where: { id }, select: { isAvailable: true, deletedAt: true, customer: { select: { name: true } } } });
    if (!c || c.isAvailable) throw new NotFoundException('Không tìm thấy hội thoại đã xoá');
    await this.prisma.$transaction([
      // Chỉ trả lại các tin bị ẩn cùng lúc xoá hội thoại; tin đã xoá lẻ trước đó vẫn ẩn.
      ...(c.deletedAt ? [this.prisma.message.updateMany({ where: { conversationId: id, isAvailable: false, deletedAt: c.deletedAt }, data: { isAvailable: true, deletedAt: null, deletedById: null } })] : []),
      this.prisma.conversation.update({ where: { id }, data: { isAvailable: true, deletedAt: null, deletedById: null } }),
    ]);
    this.log.log(`${user.fullName} khôi phục hội thoại ${id}`);
    this.realtime.emit('conversation:update', { id });
    return { ok: true, id, name: c.customer.name };
  }

  async xoaHanHoiThoai(user: AuthUser, id: string, force: boolean) {
    const c = await this.prisma.conversation.findUnique({ where: { id }, select: { isAvailable: true } });
    if (!c || c.isAvailable) throw new NotFoundException('Chỉ xoá hẳn được hội thoại đang ở tab Khôi phục');
    return this.convs.xoaHan(user, id, force);
  }

  async khoiPhucTin(user: AuthUser, id: string) {
    const m = await this.prisma.message.findUnique({ where: { id }, select: { isAvailable: true, conversationId: true, conversation: { select: { isAvailable: true, customer: { select: { name: true } } } } } });
    if (!m || m.isAvailable) throw new NotFoundException('Không tìm thấy tin đã xoá');
    if (!m.conversation.isAvailable) throw new BadRequestException('Hội thoại của tin này cũng đã bị xoá, hãy khôi phục hội thoại trước');
    await this.prisma.message.update({ where: { id }, data: { isAvailable: true, deletedAt: null, deletedById: null, changedAt: new Date() } });
    await this.actions.capNhatXemTruoc(m.conversationId);
    this.log.log(`${user.fullName} khôi phục tin ${id}`);
    this.realtime.emit('message:update', { conversationId: m.conversationId, messageId: id });
    this.realtime.emit('conversation:update', { id: m.conversationId });
    return { ok: true, conversationId: m.conversationId, name: m.conversation.customer.name };
  }

  async xoaHanTin(user: AuthUser, id: string) {
    const m = await this.prisma.message.findUnique({ where: { id }, select: { isAvailable: true, conversationId: true, attachmentPath: true, conversation: { select: { isAvailable: true, customer: { select: { name: true } } } } } });
    if (!m || m.isAvailable) throw new NotFoundException('Chỉ xoá hẳn được tin đang ở tab Khôi phục');
    await this.prisma.message.delete({ where: { id } });
    if (m.attachmentPath) await this.tep.xoaTep(m.attachmentPath);
    this.log.warn(`${user.fullName} (${user.id}) xoá hẳn tin ${id} của hội thoại ${m.conversationId}`);
    return { ok: true, name: m.conversation.customer.name };
  }
}
