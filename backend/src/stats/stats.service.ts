import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { tomTatPhanHoi } from '../common/response-time';
import { Granularity, seriesBuckets, seriesEnd } from '../common/stats-series';
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
  private cache = new Map<Period, { at: number; data: unknown }>();
  private seriesCache = new Map<string, { at: number; data: unknown }>();

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  async get(period: Period) {
    const c = this.cache.get(period);
    if (c && Date.now() - c.at < CACHE_MS) return c.data;
    const data = await this.tinh(period);
    this.cache.set(period, { at: Date.now(), data });
    return data;
  }

  private prices() {
    return {
      input: Number(this.config.get('GEMINI_PRICE_INPUT_PER_M') ?? 0.25),
      output: Number(this.config.get('GEMINI_PRICE_OUTPUT_PER_M') ?? 1.5),
      rate: Number(this.config.get('USD_VND_RATE') ?? 26000),
    };
  }

  /** Mọi phép đếm diễn ra ở PostgreSQL, chỉ lấy một dòng cho mỗi mốc; không đọc bảng messages. */
  async getSeries(granularity: Granularity, periods: number) {
    const buckets = seriesBuckets(granularity, periods);
    const key = `${granularity}:${periods}:${buckets.at(-1)?.start}`;
    const cached = this.seriesCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
    const from = new Date(buckets[0].start);
    const to = seriesEnd(granularity, buckets.at(-1)!.start);
    type CountRow = { start: Date; count: bigint };
    type DealRow = { start: Date; deals: bigint; revenue: bigint | null };
    type UsageRow = { start: Date; input: bigint; output: bigint };
    const [customers, contacts, deals, usage] = await Promise.all([
      this.prisma.$queryRaw<CountRow[]>`
        SELECT date_trunc(${granularity}, (c."lastCustomerMessageAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COUNT(DISTINCT c."customerId") AS count
        FROM conversations c
        WHERE c."lastCustomerMessageAt" >= ${from} AND c."lastCustomerMessageAt" < ${to}
        GROUP BY 1`,
      this.prisma.$queryRaw<CountRow[]>`
        SELECT date_trunc(${granularity}, (c."contactRequestedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COUNT(*) AS count
        FROM conversations c
        WHERE c."contactRequestedAt" >= ${from} AND c."contactRequestedAt" < ${to}
        GROUP BY 1`,
      this.prisma.$queryRaw<DealRow[]>`
        SELECT date_trunc(${granularity}, (d."closedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COUNT(*) AS deals, COALESCE(SUM(d.amount), 0) AS revenue
        FROM deals d
        WHERE d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."closedAt" >= ${from} AND d."closedAt" < ${to}
        GROUP BY 1`,
      this.prisma.$queryRaw<UsageRow[]>`
        SELECT date_trunc(${granularity}, (u."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AT TIME ZONE 'UTC' AS start,
               COALESCE(SUM(u."inputTokens"), 0) AS input, COALESCE(SUM(u."outputTokens"), 0) AS output
        FROM ai_usage u
        WHERE u."createdAt" >= ${from} AND u."createdAt" < ${to}
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
      connected: channel === 'WEB' || channel === 'APP',
    }));
  }

  /**
   * 10 khách có tổng tiền đơn đã chốt lớn nhất trong kỳ, mọi kênh. Chỉ tính đơn CONFIRMED (sale xác nhận hoặc booking đã thanh toán);
   * đơn chờ xác nhận, đã huỷ, hoặc bị huỷ khi mở lại hội thoại (voidedAt) không tính.
   */
  private async khachChiNhieuNhat(from: Date) {
    const where = { closedAt: { gte: from }, voidedAt: null, status: 'CONFIRMED' as const };
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

  private async tinh(period: Period) {
    const from = dauKy(period);
    const where = { createdAt: { gte: from } };

    // Khách có tin trong kỳ = hội thoại có tin gần nhất của khách từ đầu kỳ (cột do trigger điền), không phải quét bảng tin nhắn.
    const khachRows = await this.prisma.$queryRaw<{ customers: bigint; phones: bigint }[]>`
      SELECT COUNT(DISTINCT c."customerId") AS customers,
             COUNT(DISTINCT c."customerId") FILTER (WHERE cu.phone IS NOT NULL) AS phones
      FROM conversations c
      JOIN customers cu ON cu.id = c."customerId"
      WHERE c."lastCustomerMessageAt" >= ${from}`;

    const [contact, deals, usage, sales, topCustomers, pending, responses] = await Promise.all([
      this.prisma.conversation.findMany({ where: { contactRequestedAt: { gte: from } }, select: { lastHandlerId: true } }),
      this.prisma.deal.findMany({
        where: { closedAt: { gte: from }, voidedAt: null, status: 'CONFIRMED' },
        select: { channel: true, tourName: true, guests: true, amount: true, closedById: true },
      }),
      this.prisma.aiUsage.aggregate({ where, _sum: { inputTokens: true, outputTokens: true } }),
      this.prisma.user.findMany({ where: { role: 'SALE' }, select: { id: true, fullName: true, onDuty: true, _count: { select: { assigned: { where: { status: { in: ['CONTACT', 'PENDING'] } } } } } } }),
      this.khachChiNhieuNhat(from),
      // Đơn đang chờ xác nhận: tính mọi lúc, không theo kỳ, vì đây là việc sale còn phải làm.
      this.prisma.deal.aggregate({ where: { status: 'PENDING', voidedAt: null }, _count: { _all: true }, _sum: { amount: true } }),
      this.prisma.contactResponse.findMany({ where: { respondedAt: { gte: from } }, select: { staffId: true, seconds: true } }),
    ]);

    const revenue = { WEB: 0, APP: 0, ZALO: 0, FACEBOOK: 0 };
    const tours = new Map<string, { name: string; orders: number; guests: number; revenue: number }>();
    const staff = new Map<string, { name: string; contact: number; closed: number; revenue: number; responses: number; avgSeconds: number | null; medianSeconds: number | null; within5MinRate: number | null; onDuty: boolean; load: number; isSale: boolean }>();
    for (const s of sales) staff.set(s.id, { name: s.fullName, contact: 0, closed: 0, revenue: 0, responses: 0, avgSeconds: null, medianSeconds: null, within5MinRate: null, onDuty: s.onDuty, load: s._count.assigned, isSale: true });
    const TU_DAT = 'self';
    const nhomStaff = (id: string | null) => {
      const key = id ?? TU_DAT;
      if (!staff.has(key)) staff.set(key, { name: id ? 'Tài khoản khác' : 'Booking tự thanh toán', contact: 0, closed: 0, revenue: 0, responses: 0, avgSeconds: null, medianSeconds: null, within5MinRate: null, onDuty: false, load: 0, isSale: false });
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
    }

    const inputTokens = usage._sum.inputTokens ?? 0;
    const outputTokens = usage._sum.outputTokens ?? 0;
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
