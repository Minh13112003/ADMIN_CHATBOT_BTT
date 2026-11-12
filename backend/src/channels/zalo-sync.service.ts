import { BadRequestException, Controller, HttpCode, Injectable, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { ZaloService } from './zalo.service';

/**
 * Kéo tin cũ của một khách Zalo về hội thoại. Chỉ GHI LẠI lịch sử: không trả lời tự động, không đổi trạng thái hội thoại,
 * không báo nhân viên, không đụng tin xem trước của danh sách. Tin đã có thì bỏ qua (theo mã tin, hoặc cùng nội dung và gần giờ).
 */
@Injectable()
export class ZaloSyncService {
  constructor(private prisma: PrismaService, private zalo: ZaloService, private realtime: RealtimeGateway) {}

  async dongBo(conversationId: string, toiDa = 50): Promise<{ them: number; tong: number }> {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { channel: true, customerId: true } });
    if (!c || c.channel !== 'ZALO') throw new BadRequestException('Chỉ dùng được cho hội thoại Zalo');
    const danhTinh = await this.prisma.customerIdentity.findFirst({ where: { customerId: c.customerId, channel: 'ZALO' }, select: { externalId: true } });
    if (!danhTinh) throw new BadRequestException('Không tìm thấy tài khoản Zalo của khách này');

    const tin = await this.zalo.layLichSu(danhTinh.externalId, toiDa);
    if (!tin.length) return { them: 0, tong: 0 };

    const daCoMa = await this.prisma.message.findMany({ where: { externalMessageId: { in: tin.map((t) => `zalo:${t.msgId}`) } }, select: { externalMessageId: true } });
    const maCo = new Set(daCoMa.map((m) => m.externalMessageId));
    // Tin nhận trực tiếp qua webhook có thể mang mã khác với mã trong lịch sử: so thêm theo nội dung và giờ.
    const tuGio = new Date(tin[0].thoiGian.getTime() - 5 * 60_000);
    const gan = await this.prisma.message.findMany({ where: { conversationId, senderType: { in: ['CUSTOMER', 'STAFF'] }, createdAt: { gte: tuGio } }, select: { text: true, createdAt: true, senderType: true } });
    const trung = (t: (typeof tin)[number]) => gan.some((g) => g.text === t.text && (g.senderType === 'CUSTOMER') === t.tuKhach && Math.abs(g.createdAt.getTime() - t.thoiGian.getTime()) < 3 * 60_000);
    const moi = tin.filter((t) => !maCo.has(`zalo:${t.msgId}`) && !trung(t));
    if (!moi.length) return { them: 0, tong: tin.length };

    await this.prisma.message.createMany({
      data: moi.map((t) => ({
        conversationId,
        senderType: t.tuKhach ? ('CUSTOMER' as const) : ('STAFF' as const),
        ...(t.tuKhach ? {} : { staffLabel: 'Zalo OA' }),
        text: t.text,
        externalMessageId: `zalo:${t.msgId}`,
        createdAt: t.thoiGian,
      })),
      skipDuplicates: true,
    });
    this.realtime.emit('conversation:update', { id: conversationId });
    return { them: moi.length, tong: tin.length };
  }
}

@Controller('conversations')
export class ZaloSyncController {
  constructor(private sync: ZaloSyncService) {}

  /** Admin bấm "Đồng bộ tin cũ từ Zalo" trong menu ⋯ của hội thoại Zalo. */
  @Roles(Role.ADMIN)
  @Post(':id/zalo-history')
  @HttpCode(200)
  dongBo(@Param('id', ParseUUIDPipe) id: string) {
    return this.sync.dongBo(id);
  }
}
