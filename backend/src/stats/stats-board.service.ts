import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BoardRange, demTheoKhoang, khoangBoard, thuGioVN, trungVi, tuanSapToi, viTriMoc } from '../common/stats-board';
import { seriesEnd } from '../common/stats-series';
import { CHUA_PHAN, sqlPhamHoiThoai } from '../common/scope';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_MS = 5 * 60_000;
const KENH = ['ZALO', 'WEB', 'APP', 'FACEBOOK'] as const;
type Kenh = (typeof KENH)[number];

/** Khoảng chia của các biểu đồ tần suất. */
const MUC_KHACH = [1, 2, 3, 5, 10]; // 1, 2, 3–4, 5–9, 10+ khách mỗi đơn
const MUC_PHAN_HOI = [0, 60, 300, 900, 3600]; // < 1 phút, 1–5, 5–15, 15–60, > 60 phút
const MUC_GIA_TRI = [0, 5e6, 10e6, 20e6, 50e6, 100e6]; // < 5 tr, 5–10, 10–20, 20–50, 50–100, > 100 tr

/**
 * Số liệu cho trang Thống kê mới (5 tab). Một lần gọi trả hết, lưu tạm 5 phút theo kỳ và phạm vi phòng.
 * Không quét bảng messages: khách nhắn tin dựa vào lastCustomerMessageAt, giờ cao điểm dựa vào lúc khách đòi gặp nhân viên.
 */
@Injectable()
export class StatsBoardService {
  private cache = new Map<string, { at: number; data: unknown }>();

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  async get(range: BoardRange, scope: string[] | null) {
    const key = `${range}:${scope === null ? '*' : [...scope].sort().join(',')}`;
    const c = this.cache.get(key);
    if (c && Date.now() - c.at < CACHE_MS) return c.data;
    const data = await this.tinh(range, scope);
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }

  private gia() {
    return {
      input: Number(this.config.get('GEMINI_PRICE_INPUT_PER_M') ?? 0.25),
      output: Number(this.config.get('GEMINI_PRICE_OUTPUT_PER_M') ?? 1.5),
      rate: Number(this.config.get('USD_VND_RATE') ?? 26000),
    };
  }

  private async tinh(range: BoardRange, scope: string[] | null) {
    const now = new Date();
    const { granularity, buckets, from, to, prevFrom } = khoangBoard(range, now);
    const starts = buckets.map((b) => new Date(b.start).getTime());
    const end = to.getTime();
    const moc = (t: Date | null) => (t ? viTriMoc(starts, end, t.getTime()) : -1);
    const zeros = () => buckets.map(() => 0);
    const pham = sqlPhamHoiThoai(scope);
    const scopeDept = scope?.filter((x) => x !== CHUA_PHAN) ?? null;
    const weeks = tuanSapToi(now);

    type KhachRow = { customerId: string; channel: Kenh; last: Date; customerCreated: Date; phone: string | null; assigneeId: string | null; contactRequestedAt: Date | null; interested: boolean; converted: boolean };
    const [khach, convNew, places, contactTimes, deals, prevDeals, tags, tagPlaces, responses, sales, handled, usage, pending, cancelled, upcoming] = await Promise.all([
      this.prisma.$queryRaw<KhachRow[]>`
        SELECT c."customerId", c.channel, c."lastCustomerMessageAt" AS last, cu."createdAt" AS "customerCreated", cu.phone, c."assigneeId", c."contactRequestedAt",
               (EXISTS (SELECT 1 FROM tour_interest_tags t WHERE t."conversationId" = c.id AND t."createdAt" >= ${from})
                 OR EXISTS (SELECT 1 FROM place_interests p WHERE p."conversationId" = c.id AND p."createdAt" >= ${from})) AS interested,
               EXISTS (SELECT 1 FROM deals d WHERE d."conversationId" = c.id AND d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."closedAt" >= ${from}) AS converted
        FROM conversations c JOIN customers cu ON cu.id = c."customerId"
        WHERE c."lastCustomerMessageAt" >= ${from} AND ${pham}`,
      this.prisma.$queryRaw<{ channel: Kenh; createdAt: Date }[]>`
        SELECT c.channel, c."createdAt" FROM conversations c WHERE c."createdAt" >= ${from} AND ${pham}`,
      this.prisma.$queryRaw<{ place: string; asks: bigint; customers: bigint }[]>`
        SELECT p.place, COUNT(*) AS asks, COUNT(DISTINCT p."customerId") AS customers
        FROM place_interests p JOIN conversations c ON c.id = p."conversationId"
        WHERE p."createdAt" >= ${from} AND ${pham}
        GROUP BY p.place ORDER BY asks DESC`,
      // Giờ khách cần nhân viên: lượt đã được phản hồi + lượt đang chờ (chưa ai trả lời).
      this.prisma.$queryRaw<{ at: Date }[]>`
        SELECT r."requestedAt" AS at FROM contact_responses r JOIN conversations c ON c.id = r."conversationId"
        WHERE r."requestedAt" >= ${from} AND ${pham}
        UNION ALL
        SELECT c."contactRequestedAt" AS at FROM conversations c
        WHERE c.status = 'CONTACT' AND c."contactRequestedAt" >= ${from} AND ${pham}`,
      this.dealsTrong(from, to, pham),
      this.dealsTrong(prevFrom, from, pham),
      this.prisma.$queryRaw<{ tourKey: string; tourName: string; place: string | null; customers: bigint }[]>`
        SELECT t."tourKey", MAX(t."tourName") AS "tourName", MAX(t."categoryName") AS place, COUNT(DISTINCT c."customerId") AS customers
        FROM tour_interest_tags t JOIN conversations c ON c.id = t."conversationId"
        WHERE t."createdAt" >= ${from} AND ${pham}
        GROUP BY t."tourKey"`,
      // Địa điểm của từng tour (từ mọi nhãn từng gắn), để xếp đơn chốt theo địa điểm.
      this.prisma.$queryRaw<{ tourKey: string; place: string | null }[]>`
        SELECT DISTINCT ON (t."tourKey") t."tourKey", t."categoryName" AS place FROM tour_interest_tags t
        WHERE t."categoryName" IS NOT NULL ORDER BY t."tourKey", t."createdAt" DESC`,
      this.prisma.$queryRaw<{ staffId: string | null; seconds: number; respondedAt: Date }[]>`
        SELECT r."staffId", r.seconds, r."respondedAt" FROM contact_responses r JOIN conversations c ON c.id = r."conversationId"
        WHERE r."respondedAt" >= ${from} AND ${pham}`,
      this.prisma.user.findMany({
        where: { role: 'SALE', ...(scopeDept === null ? {} : { departmentId: { in: scopeDept } }) },
        select: { id: true, fullName: true, employeeCode: true, position: true, onDuty: true, isActive: true, department: { select: { name: true } } },
      }),
      this.prisma.$queryRaw<{ id: string; count: bigint }[]>`
        SELECT c."lastHandlerId" AS id, COUNT(*) AS count FROM conversations c
        WHERE c."lastHandlerId" IS NOT NULL AND c."lastCustomerMessageAt" >= ${from} AND ${pham}
        GROUP BY c."lastHandlerId"`,
      this.prisma.$queryRaw<{ createdAt: Date; channel: Kenh | null; input: number; output: number }[]>`
        SELECT u."createdAt", c.channel, u."inputTokens" AS input, u."outputTokens" AS output
        FROM ai_usage u LEFT JOIN conversations c ON c.id = u."conversationId"
        WHERE u."createdAt" >= ${from} AND ${pham}`,
      this.prisma.$queryRaw<{ count: bigint; amount: bigint | null }[]>`
        SELECT COUNT(*) AS count, COALESCE(SUM(d.amount), 0) AS amount FROM deals d JOIN conversations c ON c.id = d."conversationId"
        WHERE d.status = 'PENDING' AND d."voidedAt" IS NULL AND ${pham}`,
      this.prisma.$queryRaw<{ count: bigint; amount: bigint | null }[]>`
        SELECT COUNT(*) AS count, COALESCE(SUM(d.amount), 0) AS amount FROM deals d JOIN conversations c ON c.id = d."conversationId"
        WHERE (d.status = 'CANCELLED' OR d."voidedAt" IS NOT NULL) AND d."createdAt" >= ${from} AND ${pham}`,
      this.prisma.$queryRaw<{ day: Date; guests: number }[]>`
        SELECT d."departureDate" AS day, d.guests FROM deals d JOIN conversations c ON c.id = d."conversationId"
        WHERE d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."departureDate" >= ${weeks[0]}::date AND d."departureDate" < ${weeks[8]}::date AND ${pham}`,
    ]);

    // ---------- Khách & Quan tâm ----------
    const byChannel = Object.fromEntries(KENH.map((k) => [k, zeros()])) as Record<Kenh, number[]>;
    const newCus = zeros();
    const returning = zeros();
    const botOnly = zeros();
    const withStaff = zeros();
    const seen = new Set<string>();
    const channelTotals: Record<Kenh, Set<string>> = { ZALO: new Set(), WEB: new Set(), APP: new Set(), FACEBOOK: new Set() };
    let phones = 0;
    let fresh = 0;
    let interested = 0;
    let converted = 0;
    let contacts = 0;
    const seenPhone = new Set<string>();
    const seenInterest = new Set<string>();
    const seenConv = new Set<string>();
    const seenFresh = new Set<string>();
    for (const r of khach) {
      const i = moc(r.last);
      if (i < 0) continue;
      byChannel[r.channel][i]++;
      channelTotals[r.channel].add(r.customerId);
      if (moc(r.customerCreated) === i) newCus[i]++;
      else returning[i]++;
      if (r.assigneeId) withStaff[i]++;
      else botOnly[i]++;
      if (r.contactRequestedAt && r.contactRequestedAt >= from) contacts++;
      if (!seen.has(r.customerId)) seen.add(r.customerId);
      if (r.phone && !seenPhone.has(r.customerId)) { seenPhone.add(r.customerId); phones++; }
      if (r.customerCreated >= from && !seenFresh.has(r.customerId)) { seenFresh.add(r.customerId); fresh++; }
      if (r.interested && !seenInterest.has(r.customerId)) { seenInterest.add(r.customerId); interested++; }
      if (r.converted && !seenConv.has(r.customerId)) { seenConv.add(r.customerId); converted++; }
    }
    const heat = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
    for (const r of contactTimes) {
      const { thu, gio } = thuGioVN(r.at);
      heat[thu][gio]++;
    }
    const totalAsks = places.reduce((a, p) => a + Number(p.asks), 0);

    // ---------- Đơn đã chốt (Tour, Doanh thu, Sale) ----------
    const placeOf = new Map(tagPlaces.map((t) => [t.tourKey, t.place]));
    const revenue = zeros();
    const dealCount = zeros();
    const guestsSeries = zeros();
    const prevRevenue = zeros();
    const revByChannel: Record<Kenh, number> = { ZALO: 0, WEB: 0, APP: 0, FACEBOOK: 0 };
    const depts = new Map<string, number[]>();
    const tours = new Map<string, { key: string; name: string; orders: number; guests: number; revenue: number }>();
    const placeDeals = new Map<string, number>();
    const perSale = new Map<string, { deals: number; revenue: number; guests: number }>();
    const perCustomer = new Map<string, { orders: number; guests: number; revenue: number; channels: Set<Kenh> }>();
    let gross = 0;
    let discount = 0;
    let totalRevenue = 0;
    let totalGuests = 0;
    for (const d of deals) {
      const i = moc(d.closedAt);
      if (i < 0) continue;
      const amount = Number(d.amount);
      revenue[i] += amount;
      dealCount[i]++;
      guestsSeries[i] += d.guests;
      totalRevenue += amount;
      totalGuests += d.guests;
      revByChannel[d.channel] += amount;
      const giam = Number(d.discount ?? 0);
      discount += giam;
      gross += d.subtotal != null ? Number(d.subtotal) : amount + giam;
      const dn = d.deptName ?? 'Chưa phân phòng';
      if (!depts.has(dn)) depts.set(dn, zeros());
      depts.get(dn)![i] += amount;
      const tk = d.tourKey ?? `name:${d.tourName}`;
      const t = tours.get(tk) ?? { key: tk, name: d.tourName, orders: 0, guests: 0, revenue: 0 };
      t.orders++;
      t.guests += d.guests;
      t.revenue += amount;
      tours.set(tk, t);
      const pl = (d.tourKey && placeOf.get(d.tourKey)) || 'Chưa rõ địa điểm';
      placeDeals.set(pl, (placeDeals.get(pl) ?? 0) + 1);
      if (d.closedById) {
        const s = perSale.get(d.closedById) ?? { deals: 0, revenue: 0, guests: 0 };
        s.deals++;
        s.revenue += amount;
        s.guests += d.guests;
        perSale.set(d.closedById, s);
      }
      const cu = perCustomer.get(d.customerId) ?? { orders: 0, guests: 0, revenue: 0, channels: new Set<Kenh>() };
      cu.orders++;
      cu.guests += d.guests;
      cu.revenue += amount;
      cu.channels.add(d.channel);
      perCustomer.set(d.customerId, cu);
    }
    const shift = from.getTime() - prevFrom.getTime();
    let prevTotal = 0;
    for (const d of prevDeals) {
      const i = viTriMoc(starts, end, d.closedAt.getTime() + shift);
      if (i < 0) continue;
      prevRevenue[i] += Number(d.amount);
      prevTotal += Number(d.amount);
    }

    const topIds = [...perCustomer.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
    const names = topIds.length
      ? await this.prisma.customer.findMany({ where: { id: { in: topIds.map(([id]) => id) } }, select: { id: true, name: true, phone: true } })
      : [];
    const nameOf = new Map(names.map((n) => [n.id, n]));

    // Tour: gộp nhãn quan tâm với đơn chốt theo tourKey.
    const tourRows = new Map<string, { key: string; name: string; place: string | null; interested: number; orders: number; guests: number; revenue: number }>();
    for (const t of tags) tourRows.set(t.tourKey, { key: t.tourKey, name: t.tourName, place: t.place, interested: Number(t.customers), orders: 0, guests: 0, revenue: 0 });
    for (const t of tours.values()) {
      const r = tourRows.get(t.key) ?? { key: t.key, name: t.name, place: placeOf.get(t.key) ?? null, interested: 0, orders: 0, guests: 0, revenue: 0 };
      Object.assign(r, { orders: t.orders, guests: t.guests, revenue: t.revenue });
      tourRows.set(t.key, r);
    }
    const placeInterest = new Map<string, number>();
    for (const t of tags) {
      const pl = t.place ?? 'Chưa rõ địa điểm';
      placeInterest.set(pl, (placeInterest.get(pl) ?? 0) + Number(t.customers));
    }
    const placeKeys = [...new Set([...placeInterest.keys(), ...placeDeals.keys()])]
      .map((p) => ({ place: p, interested: placeInterest.get(p) ?? 0, orders: placeDeals.get(p) ?? 0 }))
      .sort((a, b) => b.interested + b.orders * 5 - (a.interested + a.orders * 5))
      .slice(0, 10);
    const upcomingGuests = Array.from({ length: 8 }, () => 0);
    for (const u of upcoming) {
      const day = u.day.toISOString().slice(0, 10);
      const i = weeks.findIndex((w, j) => j < 8 && day >= w && day < weeks[j + 1]);
      if (i >= 0) upcomingGuests[i] += u.guests;
    }

    // ---------- Hiệu suất sale ----------
    const secondsAll = responses.map((r) => r.seconds);
    const handledOf = new Map(handled.map((h) => [h.id, Number(h.count)]));
    const respOf = new Map<string, { seconds: number[]; byBucket: number[][] }>();
    for (const r of responses) {
      if (!r.staffId) continue;
      const x = respOf.get(r.staffId) ?? { seconds: [], byBucket: buckets.map(() => []) };
      x.seconds.push(r.seconds);
      const i = moc(r.respondedAt);
      if (i >= 0) x.byBucket[i].push(r.seconds);
      respOf.set(r.staffId, x);
    }
    const saleRows = sales
      .map((s) => {
        const d = perSale.get(s.id) ?? { deals: 0, revenue: 0, guests: 0 };
        const r = respOf.get(s.id);
        const conv = handledOf.get(s.id) ?? 0;
        return {
          id: s.id,
          name: s.fullName,
          employeeCode: s.employeeCode,
          position: s.position,
          departmentName: s.department?.name ?? null,
          onDuty: s.onDuty,
          isActive: s.isActive,
          conversations: conv,
          responses: r?.seconds.length ?? 0,
          medianSeconds: trungVi(r?.seconds ?? []),
          within5MinRate: r?.seconds.length ? r.seconds.filter((x) => x <= 300).length / r.seconds.length : null,
          deals: d.deals,
          guests: d.guests,
          revenue: d.revenue,
          closeRate: conv ? Math.min(1, d.deals / conv) : null,
          medianSeries: r ? r.byBucket.map((v) => trungVi(v)) : buckets.map(() => null),
        };
      })
      .filter((s) => s.isActive || s.deals || s.responses)
      .sort((a, b) => b.revenue - a.revenue || b.deals - a.deals || b.conversations - a.conversations);

    // ---------- Kênh & Chi phí AI ----------
    const convByChannel = Object.fromEntries(KENH.map((k) => [k, zeros()])) as Record<Kenh, number[]>;
    for (const c of convNew) {
      const i = moc(c.createdAt);
      if (i >= 0) convByChannel[c.channel][i]++;
    }
    const price = this.gia();
    const cost = (input: number, output: number) => ((input * price.input + output * price.output) / 1e6) * price.rate;
    const costSeries = zeros();
    const tokenSeries = zeros();
    const costByChannel: Record<Kenh | 'OTHER', number> = { ZALO: 0, WEB: 0, APP: 0, FACEBOOK: 0, OTHER: 0 };
    let totalCost = 0;
    let totalTokens = 0;
    for (const u of usage) {
      const i = moc(u.createdAt);
      if (i < 0) continue;
      const v = cost(u.input, u.output);
      costSeries[i] += v;
      tokenSeries[i] += u.input + u.output;
      costByChannel[u.channel ?? 'OTHER'] += v;
      totalCost += v;
      totalTokens += u.input + u.output;
    }
    const botConversations = botOnly.reduce((a, b) => a + b, 0);
    const staffConversations = withStaff.reduce((a, b) => a + b, 0);

    return {
      range,
      granularity,
      updatedAt: now,
      from,
      to,
      buckets: buckets.map((b) => ({ start: b.start, end: seriesEnd(granularity, b.start).toISOString(), label: b.label })),
      customers: {
        total: seen.size,
        newCustomers: fresh,
        phones,
        contacts,
        interested,
        converted,
        byChannelSeries: byChannel,
        byChannelTotal: Object.fromEntries(KENH.map((k) => [k, channelTotals[k].size])) as Record<Kenh, number>,
        newSeries: newCus,
        returningSeries: returning,
        contactHeatmap: heat,
        places: places.slice(0, 10).map((p) => ({ place: p.place, asks: Number(p.asks), customers: Number(p.customers) })),
        totalAsks,
      },
      tours: {
        interestedTours: tags.length,
        rows: [...tourRows.values()].sort((a, b) => b.revenue - a.revenue || b.interested - a.interested),
        byPlace: placeKeys,
        guestsPerDeal: { labels: ['1 khách', '2 khách', '3–4 khách', '5–9 khách', '10+ khách'], counts: demTheoKhoang(deals.map((d) => d.guests), MUC_KHACH) },
        upcoming: weeks.slice(0, 8).map((w, i) => ({ week: w, guests: upcomingGuests[i] })),
      },
      revenue: {
        total: totalRevenue,
        prevTotal,
        deals: deals.length,
        guests: totalGuests,
        gross,
        discount,
        series: revenue,
        prevSeries: prevRevenue,
        dealSeries: dealCount,
        guestSeries: guestsSeries,
        byChannel: revByChannel,
        byDepartment: scope === null ? [...depts.entries()].map(([name, series]) => ({ name, series, total: series.reduce((a, b) => a + b, 0) })).sort((a, b) => b.total - a.total) : [],
        valueHistogram: { labels: ['< 5 tr', '5–10 tr', '10–20 tr', '20–50 tr', '50–100 tr', '> 100 tr'], counts: demTheoKhoang(deals.map((d) => Number(d.amount)), MUC_GIA_TRI) },
        pending: { count: Number(pending[0]?.count ?? 0), amount: Number(pending[0]?.amount ?? 0) },
        cancelled: { count: Number(cancelled[0]?.count ?? 0), amount: Number(cancelled[0]?.amount ?? 0) },
        topCustomers: topIds.map(([id, v]) => ({ id, name: nameOf.get(id)?.name ?? 'Khách đã xoá', phone: nameOf.get(id)?.phone ?? null, orders: v.orders, guests: v.guests, revenue: v.revenue, channels: [...v.channels] })),
      },
      sales: {
        rows: saleRows,
        responses: secondsAll.length,
        medianSeconds: trungVi(secondsAll),
        within5MinRate: secondsAll.length ? secondsAll.filter((x) => x <= 300).length / secondsAll.length : null,
        responseHistogram: { labels: ['< 1 phút', '1–5 phút', '5–15 phút', '15–60 phút', '> 60 phút'], counts: demTheoKhoang(secondsAll, MUC_PHAN_HOI) },
        medianSeries: buckets.map((_, i) => trungVi(responses.filter((r) => moc(r.respondedAt) === i).map((r) => r.seconds))),
      },
      channels: {
        conversationsSeries: convByChannel,
        botSeries: botOnly,
        staffSeries: withStaff,
        botConversations,
        staffConversations,
        cost: totalCost,
        tokens: totalTokens,
        costSeries,
        tokenSeries,
        costByChannel,
      },
    };
  }

  private dealsTrong(from: Date, to: Date, pham: ReturnType<typeof sqlPhamHoiThoai>) {
    type DealRow = { id: string; channel: Kenh; tourName: string; tourKey: string | null; guests: number; amount: bigint; subtotal: bigint | null; discount: bigint | null; closedAt: Date; closedById: string | null; customerId: string; deptName: string | null };
    return this.prisma.$queryRaw<DealRow[]>`
      SELECT d.id, d.channel, d."tourName", d."tourKey", d.guests, d.amount, d.subtotal, d.discount, d."closedAt", d."closedById", d."customerId", dp.name AS "deptName"
      FROM deals d JOIN conversations c ON c.id = d."conversationId"
      LEFT JOIN users u ON u.id = c."assigneeId" LEFT JOIN departments dp ON dp.id = u."departmentId"
      WHERE d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."closedAt" >= ${from} AND d."closedAt" < ${to} AND ${pham}`;
  }
}
