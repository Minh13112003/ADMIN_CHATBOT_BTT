import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { Prisma, Role } from '../generated/prisma/client';
import { canAssignAgain, chonNguoiXuLy, StaffLoad } from '../common/assignment';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const KHOA_CHIA_VIEC = 738_201; // Số bất kỳ cho pg_advisory_xact_lock, tránh 2 khách cùng lúc chia trùng người.

@Injectable()
export class AssignmentService {
  private log = new Logger('Assignment');

  constructor(private prisma: PrismaService, private config: ConfigService, private realtime: RealtimeGateway) {}

  /** Gọi trong transaction. Trả id người được chia, null nếu không còn ai đang trực. */
  async chia(tx: Prisma.TransactionClient, nguoiCu: string | null, boQua: string[] = []): Promise<{ id: string; fullName: string } | null> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_CHIA_VIEC})`;
    const sales = await tx.user.findMany({
      where: { role: Role.SALE, isActive: true, onDuty: true },
      select: { id: true, fullName: true, lastAssignedAt: true },
    });
    const dem = await tx.conversation.groupBy({
      by: ['assigneeId'],
      where: { assigneeId: { in: sales.map((s) => s.id) }, status: { in: ['CONTACT', 'PENDING'] } },
      _count: { _all: true },
    });
    const staff: StaffLoad[] = sales.map((s) => ({
      id: s.id,
      lastAssignedAt: s.lastAssignedAt,
      load: dem.find((d) => d.assigneeId === s.id)?._count._all ?? 0,
    }));
    const id = chonNguoiXuLy(staff, nguoiCu, boQua);
    if (!id) return null;
    await tx.user.update({ where: { id }, data: { lastAssignedAt: new Date() } });
    return sales.find((s) => s.id === id)!;
  }

  /**
   * Mỗi 30 giây: khách Liên hệ chưa có người, hoặc người được chia chưa trả lời khách sau N phút (bot vẫn chạy), thì chia lại.
   * Khách có đơn chờ xác nhận mà chưa ai phụ trách (chatbot ghi thẳng database lúc backend tắt) cũng được chia.
   */
  @Cron('*/30 * * * * *')
  async chiaLai() {
    const phut = Number(this.config.get('CONTACT_ACCEPT_MINUTES') ?? 3);
    const han = new Date(Date.now() - phut * 60_000);
    const convs = await this.prisma.conversation.findMany({
      where: {
        OR: [
          { status: 'CONTACT', assigneeId: null },
          { status: 'CONTACT', mode: 'BOT', contactAssignedAt: { lt: han } },
          { status: 'PENDING', assigneeId: null },
        ],
      },
      select: { id: true, assigneeId: true, lastHandlerId: true },
      take: 50,
    });
    for (const c of convs) {
      try {
        const moi = await this.prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(${KHOA_CHIA_VIEC})`;
          const current = await tx.conversation.findUnique({ where: { id: c.id }, select: { status: true, mode: true, assigneeId: true, contactAssignedAt: true, lastHandlerId: true } });
          if (!current || !canAssignAgain(current, han)) return null;
          const nguoi = await this.chia(tx, current.assigneeId ? null : current.lastHandlerId, current.assigneeId ? [current.assigneeId] : []);
          if (!nguoi) return null;
          await tx.conversation.update({
            where: { id: c.id },
            data: { assigneeId: nguoi.id, lastHandlerId: nguoi.id, contactAssignedAt: new Date() },
          });
          const noiDung = current.assigneeId ? `Quá ${phut} phút chưa ai trả lời khách. Hệ thống chuyển cho ${nguoi.fullName}` : `Hệ thống chia cho ${nguoi.fullName}`;
          return tx.message.create({ data: { conversationId: c.id, senderType: 'SYSTEM', internal: true, text: noiDung } });
        });
        if (moi) {
          this.realtime.emit('message:new', { conversationId: c.id, message: moi });
          this.realtime.emit('conversation:update', { id: c.id });
        }
      } catch (e) {
        this.log.warn(`Chia lại ${c.id} lỗi: ${(e as Error).message}`);
      }
    }
  }
}
