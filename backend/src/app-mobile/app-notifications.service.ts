import { Injectable, NotFoundException } from '@nestjs/common';
import { thongBaoDon, trangApp } from '../common/app-booking';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Thông báo trong app (đợt 3). Chưa gửi thông báo đẩy Firebase (chủ dự án để sau): khách mở tab Thông báo mới thấy. */
@Injectable()
export class AppNotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Ghi thông báo đơn đổi trạng thái cho khách có tài khoản app. Không có tài khoản thì bỏ qua. Gọi trong cùng transaction đổi trạng thái. */
  async baoDon(tx: Prisma.TransactionClient, d: { customerId: string; dealId: string; tourName: string; status: string }) {
    const nd = thongBaoDon(d.status, d.tourName);
    if (!nd) return;
    const t = await tx.appAccount.findUnique({ where: { customerId: d.customerId }, select: { id: true } });
    if (!t) return;
    await tx.appNotification.create({ data: { accountId: t.id, ...nd, type: 'BOOKING_STATUS', refType: 'BOOKING', refId: d.dealId } });
  }

  async danhSach(accountId: string, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.prisma.appNotification.findMany({
        where: { accountId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        select: { id: true, title: true, message: true, type: true, refType: true, refId: true, isRead: true, createdAt: true },
      }),
      this.prisma.appNotification.count({ where: { accountId } }),
    ]);
    return trangApp(items, total, page, limit);
  }

  async chuaDoc(accountId: string) {
    return { count: await this.prisma.appNotification.count({ where: { accountId, isRead: false } }) };
  }

  async docHet(accountId: string) {
    const r = await this.prisma.appNotification.updateMany({ where: { accountId, isRead: false }, data: { isRead: true } });
    return { updated: r.count };
  }

  async doc(accountId: string, id: string) {
    const r = await this.prisma.appNotification.updateMany({ where: { id, accountId }, data: { isRead: true } });
    if (!r.count) throw new NotFoundException('Không tìm thấy thông báo');
    return { success: true };
  }
}
