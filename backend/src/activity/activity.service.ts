import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, Role } from '../generated/prisma/client';
import { khoangNgayVN, type MucNhatKy, type NhomThaoTac } from '../common/activity';
import { PrismaService } from '../prisma/prisma.service';

export type NguoiLam = { id: string; fullName: string; role: Role };

/** Nhật ký thao tác của nhân viên (2026-11-26). Ghi không bao giờ làm hỏng thao tác chính: lỗi chỉ ghi log server. */
@Injectable()
export class ActivityService {
  private log = new Logger('Activity');
  constructor(private prisma: PrismaService) {}

  async ghi(nguoi: NguoiLam, muc: MucNhatKy, ip?: string | null) {
    try {
      await this.prisma.activityLog.create({
        data: {
          actorId: nguoi.id,
          actorName: nguoi.fullName,
          actorRole: nguoi.role,
          group: muc.group,
          action: muc.action,
          summary: muc.summary.slice(0, 1000),
          conversationId: muc.conversationId || null,
          targetId: muc.targetId || null,
          ip: ip ? ip.slice(0, 64) : null,
        },
      });
    } catch (e) {
      this.log.warn(`Không ghi được nhật ký "${muc.action}": ${(e as Error).message}`);
    }
  }

  /**
   * Nhật ký một ngày (giờ Việt Nam), mới nhất trước, mỗi lần 100 dòng. Kèm số thao tác theo nhóm và theo người trong ngày
   * (đếm trên cả ngày, không theo bộ lọc nhóm/người) để vẽ bảng tóm tắt.
   */
  async ngay(q: { date: string; actorId?: string; group?: NhomThaoTac; search?: string; before?: string }) {
    const khoang = khoangNgayVN(q.date);
    if (!khoang) throw new BadRequestException('Ngày không hợp lệ');
    const ngayWhere: Prisma.ActivityLogWhereInput = { createdAt: { gte: khoang.tu, lt: khoang.den } };
    const moc = q.before ? new Date(q.before) : null;
    if (moc && Number.isNaN(moc.getTime())) throw new BadRequestException('Mốc không hợp lệ');
    const where: Prisma.ActivityLogWhereInput = {
      AND: [
        ngayWhere,
        q.actorId ? { actorId: q.actorId } : {},
        q.group ? { group: q.group } : {},
        q.search?.trim() ? { summary: { contains: q.search.trim(), mode: 'insensitive' } } : {},
        moc ? { createdAt: { lt: moc } } : {},
      ],
    };
    const N = 100;
    const [rows, theoNhom, theoNguoi] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: N + 1,
        select: { id: true, actorId: true, actorName: true, actorRole: true, group: true, action: true, summary: true, conversationId: true, targetId: true, createdAt: true },
      }),
      q.before ? Promise.resolve(null) : this.prisma.activityLog.groupBy({ by: ['group'], where: ngayWhere, _count: { _all: true } }),
      q.before ? Promise.resolve(null) : this.prisma.activityLog.groupBy({ by: ['actorId', 'actorName', 'actorRole'], where: ngayWhere, _count: { _all: true } }),
    ]);
    const items = rows.slice(0, N);
    return {
      items,
      hasMore: rows.length > N,
      nextBefore: rows.length > N ? items[items.length - 1].createdAt.toISOString() : null,
      ...(theoNhom && theoNguoi
        ? {
            summary: {
              total: theoNhom.reduce((s, x) => s + x._count._all, 0),
              groups: Object.fromEntries(theoNhom.map((x) => [x.group, x._count._all])),
              actors: theoNguoi
                .map((x) => ({ id: x.actorId, name: x.actorName, role: x.actorRole, count: x._count._all }))
                .sort((a, b) => b.count - a.count),
            },
          }
        : {}),
    };
  }
}
