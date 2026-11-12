import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tomTatPhanHoi } from '../common/response-time';
import { Granularity, seriesBuckets, seriesEnd } from '../common/stats-series';
import { Prisma } from '../generated/prisma/client';
import { locHoiThoai, sqlPhamHoiThoai } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

export type Period = 'today' | 'week' | 'month' | 'all';
const CACHE_MS = 5 * 60_000;
const VN_MS = 7 * 3600_000;

/** Mốc đầu kỳ theo giờ Việt Nam. */
export function dauKy(period: Period, now = new Date()): Date {
  const vn = new Date(now.getTime() + VN_MS);
  const y = vn.getUTCFullYear();
  const m = vn.getUTCMonth();
  const d = vn.getUTCDate();
  if (period === 'all') return new Date(0);
  if (period === 'month') return new Date(Date.UTC(y, m, 1) - VN_MS);
  if (period === 'week') return new Date(Date.UTC(y, m, d - 6) - VN_MS);
  return new Date(Date.UTC(y, m, d) - VN_MS);
}

/** Thống kê lưu tạm 5 phút theo yêu cầu: không cần thời gian thực. */
@Injectable()
export class StatsService {
  private cache = new Map<string, { at: number; data: unknown }>();
  private seriesCache = new Map<string, { at: number; data: unknown }>();

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  /** Lưu tạm theo kỳ và theo phạm vi phòng, để admin phòng không bao giờ nhận số của phòng khác. */
  async get(period: Period, scope: string[] | null = null) {
    const key = `${period}:${scope === null ? '*' : [...scope].sort().join(',')}`;
    const c = this.cache.get(key);
    if (c && Date.now() - c.at < CACHE_MS) return c.data;
    const data = await this.tinh(period, scope);
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }

  private prices() {
    return {
      input: Number(this.config.get('GEMINI_PRICE_INPUT_PER_M') ?? 0.25),
      output: Number(this.config.get('GEMINI_PRICE_OUTPUT_PER_M') ?? 1.5),
      rate: Number(this.config.get('USD_VND_RATE') ?? 26000),
    };
  }

  /** Chi tiết báo cáo dùng cùng phạm vi với KPI, không gọi danh sách đơn toàn hệ thống. */
  async getOrders(period: Period, scope: string[] | null, query: { status?: 'CONFIRMED' | 'PENDING' | 'CANCELLED'; search?: string; staffId?: string; page?: number }) {
    const status = query.status ?? 'CONFIRMED';
    const from = dauKy(period);
    const search = query.search?.trim();
    const where: Prisma.DealWhereInput = {
      conversation: locHoiThoai(scope),
      ...(query.staffId ? { closedById: query.staffId } : {}),
      AND: [
        status === 'CANCELLED'
          ? { OR: [{ status: 'CANCELLED' }, { voidedAt: { not: null } }], createdAt: { gte: from } }
          : { status, voidedAt: null, ...(status === 'CONFIRMED' ? { closedAt: { gte: from } } : { createdAt: { gte: from } }) },
        ...(search ? [{ OR: [{ tourName: { contains: search, mode: 'insensitive' as const } }, { orderCode: { contains: search, mode: 'insensitive' as const } }, { customer: { name: { contains: search, mode: 'insensitive' as const } } }, { customer: { phone: { contains: search } } }] }] : []),
      ],
    };
    const page = query.page ?? 1;
    const [total, rows] = await Promise.all([
      this.prisma.deal.count({ where }),
      this.prisma.deal.findMany({ where, orderBy: [{ closedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * 20, take: 20,
        select: { id: true, orderCode: true, tourName: true, tourCode: true, guests: true, amount: true, status: true, voidedAt: true, closedAt: true, createdAt: true, channel: true, conversationId: true,
          customer: { select: { name: true, phone: true } }, closedBy: { select: { fullName: true } },
          conversation: { select: { assignee: { select: { department: { select: { name: true } } } } } },
        },
      }),
    ]);
    return { total, page, pageSize: 20, items: rows.map((row) => ({ ...row, amount: Number(row.amount), departmentName: row.conversation.assignee?.department?.name ?? 'Chưa phân phòng', conversation: undefined })) };
  }

  /** Mọi phép đếm diễn ra ở PostgreSQL, chỉ lấy một dòng cho mỗi mốc; không đọc bảng messages. */
  async getSeries(granularity: Granularity, periods: number, scope: string[] | null = null, period?: Period) {
    const periodStart = period ? dauKy(period) : null;
    const buckets = seriesBuckets(granularity, period ? 60 : periods).filter(b => !periodStart || seriesEnd(granularity, b.start) > periodStart);
    const key = `${granularity}:${periods}:${period ?? 'rolling'}:${buckets.at(-1)?.start}:${scope === null ? '*' : [...scope].sort().join(',')}`;
    const pham = sqlPhamHoiThoai(scope);
    const cached = this.seriesCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
    const from = new Date(Math.max(new Date(buckets[0].start).getTime(), periodStart?.getTime() ?? 0));
    const to = seriesEnd(granularity, buckets.at(-1)!.start);
    type CountRow = { start: Date; count: bigint };
    type DealRow = { start: Date; deals: bigint; revenue: bigint | null };
    type UsageRow = { start: Date; input: bigint; output: bigint };
    const [customers, contacts, deals, usage] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>`
        SELECT date_trunc(${granularity}, (c."lastCustomerMessageAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COUNT(DISTINCT c."customerId") AS count
        FROM conversations c
        WHERE c."lastCustomerMessageAt" >= ${from} AND c."lastCustomerMessageAt" < ${to} AND ${pham}
        GROUP BY 1`,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT date_trunc(${granularity}, (c."contactRequestedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COUNT(*) AS count
        FROM conversations c
        WHERE c."contactRequestedAt" >= ${from} AND c."contactRequestedAt" < ${to} AND ${pham}
        GROUP BY 1`,
      this.prisma.$queryRaw<DealRow[]>`
        SELECT date_trunc(${granularity}, (d."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COUNT(*) AS deals, COALESCE(SUM(d.amount), 0) AS revenue
        FROM deals d JOIN conversations c ON c.id = d."conversationId"
        WHERE d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."closedAt" >= ${from} AND d."closedAt" < ${to} AND ${pham}
        GROUP BY 1`,
      this.prisma.$queryRaw<UsageRow[]>`
        SELECT date_trunc(${granularity}, (u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COALESCE(SUM(u."inputTokens"), 0) AS input, COALESCE(SUM(u."outputTokens"), 0) AS output
        FROM ai_usage u JOIN conversations c ON c.id = u."conversationId"
        WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to} AND ${pham}
        GROUP BY 1`,
    ]);
    const byStart = <T extends { start: Date }>(rows: T[]) => new Map(rows.map((r) => [r.start.toISOString(), r]));
    const c = byStart(customers), h = byStart(contacts), d = byStart(deals), u = byStart(usage);
    const price = this.prices();
    const data = buckets.map((b) => {
      const tokens = u.get(b.start);
      const costVnd = tokens ? ((Number(tokens.input) * price.input + Number(tokens.output) * price.output) / 1e6) * price.rate : 0;
      return { ...b, customers: Number(c.get(b.start)?.count ?? 0), contacts: Number(h.get(b.start)?.count ?? 0), deals: Number(d.get(b.start)?.deals ?? 0), revenue: Number(d.get(b.start)?.revenue ?? 0), costVnd };
    });
    this.seriesCache.set(key, { at: Date.now(), data });
    return data;
  }

  async getCostBySource(period: Period) {
    const key = `cost:${period}`;
    const cached = this.seriesCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
    const from = dauKy(period);
    const rows = await this.prisma.$queryRaw<{ input: bigint; output: bigint }[]>`
      SELECT COALESCE(SUM(u."inputTokens"), 0) AS input, COALESCE(SUM(u."outputTokens"), 0) AS output
      FROM ai_usage u JOIN conversations c ON c.id = u."conversationId"
      WHERE u."createdAt" >= ${from} AND c.channel IN ('APP', 'WEB')`;
    const price = this.prices();
    const costVnd = ((Number(rows[0]?.input ?? 0) * price.input + Number(rows[0]?.output ?? 0) * price.output) / 1e6) * price.rate;
    const data = [
      { source: 'AI', costVnd, share: costVnd ? 1 : 0, connected: true },
      { source: 'ZALO', costVnd: 0, share: 0, connected: false },
      { source: 'FACEBOOK', costVnd: 0, share: 0, connected: false },
    ];
    this.seriesCache.set(key, { at: Date.now(), data });
    return data;
  }

  async getChannels() {
    const from = dauKy('today');
    const conversations = await this.prisma.conversation.groupBy({
      by: ['channel'], where: { lastCustomerMessageAt: { gte: from } }, _count: { _all: true },
    });
    const responseRows = await this.prisma.$queryRaw<{ channel: string; seconds: number }[]>`
      SELECT c.channel, r.seconds FROM contact_responses r
      JOIN conversations c ON c.id = r."conversationId"
      WHERE r."respondedAt" >= ${from}`;
    const ganNhat = await this.prisma.conversation.groupBy({ by: ['channel'], _max: { lastCustomerMessageAt: true } });
    return ['WEB', 'APP', 'ZALO', 'FACEBOOK'].map((channel) => ({
      channel,
      lastCustomerMessageAt: ganNhat.find((c) => c.channel === channel)?._max.lastCustomerMessageAt ?? null,
      conversationsToday: conversations.find((c) => c.channel === channel)?._count._all ?? 0,
      medianSeconds: tomTatPhanHoi(responseRows.filter((r) => r.channel === channel).map((r) => r.seconds)).medianSeconds,
      connected: channel === 'WEB' || channel === 'APP' || (channel === 'ZALO' && !!ganNhat.find((c) => c.channel === channel)?._max.lastCustomerMessageAt),
    }));
  }

  /**
   * 10 khách có tổng tiền đơn đã chốt lớn nhất trong kỳ, mọi kênh. Chỉ tính đơn CONFIRMED (sale xác nhận hoặc booking đã thanh toán);
   * đơn chờ xác nhận, đã huỷ, hoặc bị huỷ khi mở lại hội thoại (voidedAt) không tính.
   */
  private async khachChiNhieuNhat(from: Date, hoiThoai: Prisma.ConversationWhereInput = {}) {
    const where = { closedAt: { gte: from }, voidedAt: null, status: 'CONFIRMED' as const, conversation: hoiThoai };
    const top = await this.prisma.deal.groupBy({
      by: ['customerId'],
      where,
      _sum: { amount: true, guests: true },
      _count: { _all: true },
      _max: { closedAt: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10,
    });
    if (!top.length) return [];
    const ids = top.map((t) => t.customerId);
    const [khach, theoKenh] = await Promise.all([
      this.prisma.customer.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, phone: true } }),
      this.prisma.deal.groupBy({ by: ['customerId', 'channel'], where: { ...where, customerId: { in: ids } }, _sum: { amount: true } }),
    ]);
    const tenKhach = new Map(khach.map((k) => [k.id, k]));
    return top.map((t) => ({
      id: t.customerId,
      name: tenKhach.get(t.customerId)?.name ?? 'Khách đã xoá',
      phone: tenKhach.get(t.customerId)?.phone ?? null,
      orders: t._count._all,
      guests: t._sum.guests ?? 0,
      revenue: Number(t._sum.amount ?? 0),
      lastClosedAt: t._max.closedAt,
      channels: theoKenh
        .filter((k) => k.customerId === t.customerId)
        .map((k) => ({ channel: k.channel, revenue: Number(k._sum.amount ?? 0) }))
        .sort((a, b) => b.revenue - a.revenue),
    }));
  }

  /** Doanh thu đã chốt theo phòng (chỉ admin toàn quyền xem), tính theo phòng của người phụ trách. */
  private async theoPhong(from: Date) {
    type R = { id: string | null; name: string | null; deals: bigint; revenue: bigint | null; guests: bigint | null };
    const rows = await this.prisma.$queryRaw<R[]>`
      SELECT dp.id, dp.name, COUNT(d.id) AS deals, COALESCE(SUM(d.amount), 0) AS revenue, COALESCE(SUM(d.guests), 0) AS guests
      FROM deals d
      JOIN conversations c ON c.id = d."conversationId"
      LEFT JOIN users u ON u.id = c."assigneeId"
      LEFT JOIN departments dp ON dp.id = u."departmentId"
      WHERE d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."closedAt" >= ${from}
      GROUP BY dp.id, dp.name ORDER BY revenue DESC`;
    return rows.map((r) => ({ id: r.id, name: r.name ?? 'Chưa phân phòng', deals: Number(r.deals), revenue: Number(r.revenue ?? 0), guests: Number(r.guests ?? 0) }));
  }

  private async tinh(period: Period, scope: string[] | null) {
    const from = dauKy(period);
    const hoiThoai = locHoiThoai(scope);
    const pham = sqlPhamHoiThoai(scope);

    // Khách có tin trong kỳ = hội thoại có tin gần nhất của khách từ đầu kỳ (cột do trigger điền), không phải quét bảng tin nhắn.
    const khachRows = await this.prisma.$queryRaw<{ customers: bigint; phones: bigint; responded: bigint; converted: bigint }[]>`
      SELECT COUNT(DISTINCT c."customerId") AS customers,
             COUNT(DISTINCT c."customerId") FILTER (WHERE cu.phone IS NOT NULL) AS phones,
             COUNT(DISTINCT c."customerId") FILTER (WHERE EXISTS (
               SELECT 1 FROM contact_responses r WHERE r."conversationId" = c.id AND r."respondedAt" >= ${from}
             )) AS responded,
             COUNT(DISTINCT c."customerId") FILTER (WHERE EXISTS (
               SELECT 1 FROM deals d WHERE d."conversationId" = c.id AND d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."closedAt" >= ${from}
             )) AS converted
      FROM conversations c
      JOIN customers cu ON cu.id = c."customerId"
      WHERE c."lastCustomerMessageAt" >= ${from} AND ${pham}`;

    const [contact, deals, usage, sales, topCustomers, pending, responses] = await Promise.all([
      this.prisma.conversation.findMany({ where: { contactRequestedAt: { gte: from }, ...hoiThoai }, select: { lastHandlerId: true } }),
      this.prisma.deal.findMany({
        where: { closedAt: { gte: from }, voidedAt: null, status: 'CONFIRMED', conversation: hoiThoai },
        select: { channel: true, tourName: true, guests: true, amount: true, closedById: true, customerId: true },
      }),
      this.prisma.$queryRaw<{ input: bigint; output: bigint }[]>`
        SELECT COALESCE(SUM(u."inputTokens"), 0) AS input, COALESCE(SUM(u."outputTokens"), 0) AS output
        FROM ai_usage u LEFT JOIN conversations c ON c.id = u."conversationId"
        WHERE u."createdAt" >= ${from} AND ${pham}`,
      this.prisma.user.findMany({ where: { role: 'SALE', ...(scope === null ? {} : { departmentId: { in: scope } }) }, select: { id: true, fullName: true, onDuty: true, department: { select: { name: true } }, _count: { select: { assigned: { where: { status: { in: ['CONTACT', 'PENDING'] } } } } } } }),
      this.khachChiNhieuNhat(from, hoiThoai),
      // Đơn đang chờ xác nhận: tính mọi lúc, không theo kỳ, vì đây là việc sale còn phải làm.
      this.prisma.deal.aggregate({ where: { status: 'PENDING', voidedAt: null, conversation: hoiThoai }, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.contactResponse.findMany({ where: { respondedAt: { gte: from }, conversation: hoiThoai }, select: { staffId: true, seconds: true } }),
    ]);

    const revenue = { WEB: 0, APP: 0, ZALO: 0, FACEBOOK: 0 };
    const tours = new Map<string, { name: string; orders: number; guests: number; revenue: number }>();
    const staff = new Map<string, { id: string; departmentName: string; name: string; contact: number; closed: number; closedCustomers: number; guests: number; revenue: number; responses: number; avgSeconds: number | null; medianSeconds: number | null; within5MinRate: number | null; onDuty: boolean; load: number; isSale: boolean }>();
    for (const s of sales) staff.set(s.id, { id: s.id, departmentName: s.department?.name ?? 'Chưa phân phòng', name: s.fullName, contact: 0, closed: 0, closedCustomers: 0, guests: 0, revenue: 0, responses: 0, avgSeconds: null, medianSeconds: null, within5MinRate: null, onDuty: s.onDuty, load: s._count.assigned, isSale: true });
    const TU_DAT = 'self';
    const nhomStaff = (id: string | null) => {
      const key = id ?? TU_DAT;
      if (!staff.has(key)) staff.set(key, { id: key, departmentName: '—', name: id ? 'Tài khoản khác' : 'Booking tự thanh toán', contact: 0, closed: 0, closedCustomers: 0, guests: 0, revenue: 0, responses: 0, avgSeconds: null, medianSeconds: null, within5MinRate: null, onDuty: false, load: 0, isSale: false });
      return staff.get(key)!;
    };
    const theoNguoi = new Map<string, number[]>();
    for (const r of responses) if (r.staffId) theoNguoi.set(r.staffId, [...(theoNguoi.get(r.staffId) ?? []), r.seconds]);
    for (const [id, giay] of theoNguoi) {
      const t = tomTatPhanHoi(giay);
      Object.assign(nhomStaff(id), { responses: t.count, avgSeconds: t.avgSeconds, medianSeconds: t.medianSeconds, within5MinRate: t.within5MinRate });
    }

    for (const c of contact) if (c.lastHandlerId) nhomStaff(c.lastHandlerId).contact += 1;
    let guests = 0;
    const staffCustomers = new Map<string, Set<string>>();
    for (const d of deals) {
      const tien = Number(d.amount);
      revenue[d.channel] += tien;
      guests += d.guests;
      const t = tours.get(d.tourName) ?? { name: d.tourName, orders: 0, guests: 0, revenue: 0 };
      t.orders += 1;
      t.guests += d.guests;
      t.revenue += tien;
      tours.set(d.tourName, t);
      const s = nhomStaff(d.closedById);
      s.closed += 1;
      s.revenue += tien;
      s.guests += d.guests;
      const customers = staffCustomers.get(s.id) ?? new Set<string>();
      customers.add(d.customerId);
      staffCustomers.set(s.id, customers);
      s.closedCustomers = customers.size;
    }

    const [huy, theoPhong] = await Promise.all([
      this.prisma.deal.groupBy({ by: ['tourName'], where: { OR: [{ status: 'CANCELLED' }, { voidedAt: { not: null } }], createdAt: { gte: from }, conversation: hoiThoai }, _count: { _all: true }, _sum: { amount: true }, orderBy: { _count: { tourName: 'desc' } } }),
      scope === null ? this.theoPhong(from) : Promise.resolve([]),
    ]);
    const inputTokens = Number(usage[0]?.input ?? 0);
    const outputTokens = Number(usage[0]?.output ?? 0);
    const giaVao = Number(this.config.get('GEMINI_PRICE_INPUT_PER_M') ?? 0.25);
    const giaRa = Number(this.config.get('GEMINI_PRICE_OUTPUT_PER_M') ?? 1.5);
    const tyGia = Number(this.config.get('USD_VND_RATE') ?? 26000);
    const inputUsd = (inputTokens / 1e6) * giaVao;
    const outputUsd = (outputTokens / 1e6) * giaRa;
    const usd = inputUsd + outputUsd;

    return {
      period,
      from,
      updatedAt: new Date(),
      customers: Number(khachRows[0]?.customers ?? 0),
      phones: Number(khachRows[0]?.phones ?? 0),
      contact: contact.length,
      closed: deals.length,
      closeRate: Number(khachRows[0]?.customers ?? 0) ? Number(khachRows[0]?.converted ?? 0) / Number(khachRows[0]?.customers ?? 0) : null,
      conversion: { respondedCustomers: Number(khachRows[0]?.responded ?? 0), closedCustomers: Number(khachRows[0]?.converted ?? 0) },
      cancelled: { count: huy.reduce((a, h) => a + h._count._all, 0), tours: huy.map((h) => ({ name: h.tourName, count: h._count._all, amount: Number(h._sum.amount ?? 0) })) },
      departments: theoPhong,
      guests,
      revenue,
      totalRevenue: Object.values(revenue).reduce((a, b) => a + b, 0),
      tours: [...tours.values()].sort((a, b) => b.revenue - a.revenue),
      staff: [...staff.values()].sort((a, b) => b.revenue - a.revenue),
      pending: { count: pending._count._all, amount: Number(pending._sum.amount ?? 0) },
      responseTime: tomTatPhanHoi(responses.map((r) => r.seconds)),
      topCustomers,
      gemini: { inputTokens, outputTokens, inputUsd, outputUsd, usd, vnd: usd * tyGia, usdVndRate: tyGia, priceInput: giaVao, priceOutput: giaRa },
    };
  }
}
