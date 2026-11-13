import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { AuthUser } from '../auth/auth.decorators';
import { phamViPhong, sqlPhamHoiThoai } from '../common/scope';
import { ngayVN, timDiaDiem } from '../common/dia-diem';
import { diaDiemTuTen, khoaTour, khopTour } from '../common/tours';
import { PrismaService } from '../prisma/prisma.service';
import { TourCatalogService, type CatalogTour } from '../tours/tour-catalog.service';

export type Bo = { tu?: Date; kenh?: string };

/** Một cặp (tour, khách) đã gộp trong SQL. */
type Cap = { key: string; cid: string; ch: string; name: string; card: Record<string, unknown> | null; cat: string | null; asks: bigint; bot: bigint; tag: bigint; first_at: Date; last_at: Date };

type Tour = {
  key: string;
  name: string;
  place: string | null;
  price: number | null;
  days: number | null;
  nights: number | null;
  image: string | null;
  askers: number;
  asks: number;
  bot: number;
  tag: number;
  firstAskedAt: Date;
  lastAskedAt: Date;
  rank: number;
  khach: Map<string, string>; // customerId -> kênh
  closed?: number;
  revenue?: number;
};

export type SapXep = 'askers' | 'revenue' | 'closed';

const so = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : null);

/**
 * Nhu cầu tour cho Digital: chỉ đếm nhãn sale ghim (tour_interest_tags), mỗi nhãn là một lượt, kèm tin đã ghim.
 * Thẻ tour chatbot gửi không còn tính (chủ dự án chốt 2026-11-11: bot gợi ý sai tour so với ý khách).
 * Gộp theo tên tour bỏ dấu (id tour trên website có thể đổi theo đợt khởi hành).
 * Khách được đếm một lần cho mỗi tour; phạm vi phòng lấy từ phiên đăng nhập.
 */
@Injectable()
export class TourInterestService {
  private log = new Logger('TourInterest');

  constructor(private prisma: PrismaService, private catalog: TourCatalogService) {}

  /** Mọi lượt quan tâm trong phạm vi: cid, kênh, lúc, nguồn, tên tour, thẻ bot, địa điểm nhãn, tin bằng chứng. */
  private suKien(user: AuthUser, bo: Bo, key?: string) {
    const pham = sqlPhamHoiThoai(phamViPhong(user));
    const kenh = bo.kenh ? Prisma.sql`AND c.channel::text = ${bo.kenh}` : Prisma.empty;
    const tuTag = bo.tu ? Prisma.sql`AND g."createdAt" >= ${bo.tu}` : Prisma.empty;
    const loc = key ? Prisma.sql`WHERE lower(btt_bo_dau(e.name)) = ${key}` : Prisma.sql`WHERE e.name IS NOT NULL`;
    // Đổi ngày 2026-11-11: bỏ thẻ tour chatbot gửi (bot gợi ý tour không có nghĩa là khách quan tâm tour đó),
    // chỉ đếm nhãn sale ghim. Giữ cột src/card để phần gộp phía dưới không phải đổi.
    return Prisma.sql`
      SELECT * FROM (
        SELECT c."customerId" AS cid, c.id AS conv_id, c.channel::text AS ch, g."createdAt" AS at, 'TAG' AS src,
               g."tourName" AS name, NULL::jsonb AS card, g."categoryName" AS cat, g.id AS ev_id, g."messageId" AS msg_id, g."createdById" AS by_id
        FROM tour_interest_tags g
        JOIN conversations c ON c.id = g."conversationId"
        WHERE ${pham} ${kenh} ${tuTag}
      ) e ${loc}`;
  }

  /** Gộp theo (tour, khách) rồi gắn địa điểm, giá từ danh mục website. */
  private async tours(user: AuthUser, bo: Bo): Promise<Tour[]> {
    const caps = await this.prisma.$queryRaw<Cap[]>`
      WITH e AS (${this.suKien(user, bo)})
      SELECT lower(btt_bo_dau(name)) AS key, cid, (array_agg(ch ORDER BY at DESC))[1] AS ch,
             (array_agg(name ORDER BY at DESC))[1] AS name,
             (array_agg(card ORDER BY at DESC) FILTER (WHERE card IS NOT NULL))[1] AS card,
             max(cat) AS cat, COUNT(*) AS asks, COUNT(*) FILTER (WHERE src = 'BOT') AS bot, COUNT(*) FILTER (WHERE src = 'TAG') AS tag,
             MIN(at) AS first_at, MAX(at) AS last_at
      FROM e GROUP BY 1, cid LIMIT 200000`;

    let danhMuc = new Map<string, CatalogTour>();
    try {
      danhMuc = new Map([...(await this.catalog.danhMuc()).tours.values()].map((t) => [khoaTour(t.name), t]));
    } catch (e) {
      this.log.warn(`Không có danh mục tour, dùng thông tin trong thẻ bot: ${(e as Error).message}`);
    }

    const theoKey = new Map<string, Tour & { card: Record<string, unknown> | null; cat: string | null }>();
    for (const c of caps) {
      let t = theoKey.get(c.key);
      if (!t) {
        t = { key: c.key, name: c.name, place: null, price: null, days: null, nights: null, image: null, askers: 0, asks: 0, bot: 0, tag: 0, firstAskedAt: c.first_at, lastAskedAt: c.last_at, rank: 0, khach: new Map(), card: c.card, cat: c.cat };
        theoKey.set(c.key, t);
      }
      t.khach.set(c.cid, c.ch);
      t.asks += Number(c.asks);
      t.bot += Number(c.bot);
      t.tag += Number(c.tag);
      if (c.first_at < t.firstAskedAt) t.firstAskedAt = c.first_at;
      if (c.last_at > t.lastAskedAt) { t.lastAskedAt = c.last_at; t.name = c.name; }
      t.card ??= c.card;
      t.cat ??= c.cat;
    }
    const ds = [...theoKey.values()].map(({ card, cat, ...t }) => {
      const web = danhMuc.get(t.key);
      return {
        ...t,
        askers: t.khach.size,
        place: web?.place?.name ?? cat ?? diaDiemTuTen(t.name),
        price: web?.price ?? so(card?.gia) ?? so(card?.price),
        days: web?.days ?? so(card?.so_ngay) ?? so(card?.days),
        nights: web?.nights ?? null,
        image: web?.image ?? (typeof card?.anh === 'string' ? card.anh : typeof card?.image === 'string' ? card.image : null),
      };
    });
    ds.sort((a, b) => b.askers - a.askers || +b.lastAskedAt - +a.lastAskedAt);
    // Hạng kiểu RANK(): bằng số khách thì cùng hạng.
    ds.forEach((t, i) => (t.rank = i > 0 && ds[i - 1].askers === t.askers ? ds[i - 1].rank : i + 1));
    return ds;
  }

  private static ra(t: Tour) {
    const { khach: _, ...con } = t;
    return con;
  }

  /** Đơn đã chốt theo tour (khoá tên bỏ dấu) trong phạm vi, kỳ, kênh. */
  private async chotTheoTour(user: AuthUser, bo: Bo) {
    const pham = sqlPhamHoiThoai(phamViPhong(user));
    const tu = bo.tu ? Prisma.sql`AND d."closedAt" >= ${bo.tu}` : Prisma.empty;
    const kenh = bo.kenh ? Prisma.sql`AND c.channel::text = ${bo.kenh}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<{ key: string; name: string; n: bigint; tien: bigint | null }[]>`
      SELECT lower(btt_bo_dau(d."tourName")) AS key, max(d."tourName") AS name, COUNT(*) AS n, SUM(d.amount) AS tien
      FROM deals d JOIN conversations c ON c.id = d."conversationId"
      WHERE d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND d."tourName" IS NOT NULL AND ${pham} ${tu} ${kenh}
      GROUP BY 1`;
    return new Map(rows.map((r) => [r.key, { name: r.name, closed: Number(r.n), revenue: Number(r.tien ?? 0) }]));
  }

  /** Địa điểm khách tự hỏi (máy nhận ra từ tin khách): mỗi dòng một khách, một địa điểm, số ngày đã hỏi. */
  private async khachTuHoi(user: AuthUser, bo: Bo) {
    const pham = sqlPhamHoiThoai(phamViPhong(user));
    const tu = bo.tu ? Prisma.sql`AND p."createdAt" >= ${bo.tu}` : Prisma.empty;
    const kenh = bo.kenh ? Prisma.sql`AND c.channel::text = ${bo.kenh}` : Prisma.empty;
    return this.prisma.$queryRaw<{ cid: string; place: string; n: bigint }[]>`
      SELECT p."customerId" AS cid, p.place, COUNT(*) AS n
      FROM place_interests p JOIN conversations c ON c.id = p."conversationId"
      WHERE ${pham} ${tu} ${kenh}
      GROUP BY 1, 2 LIMIT 200000`;
  }

  async ranking(user: AuthUser, q: { view: 'tour' | 'place'; search?: string; take: number; skip: number; moi?: boolean; sort?: SapXep } & Bo) {
    const ds = await this.tours(user, q);
    const moiTu = Date.now() - 30 * 86_400_000;
    const tuHoi = await this.khachTuHoi(user, q);
    const tatCaKhach = new Set([...ds.flatMap((t) => [...t.khach.keys()]), ...tuHoi.map((r) => r.cid)]);
    const noi = this.theoNoi(ds, tuHoi);
    const summary = {
      tours: ds.length,
      customers: tatCaKhach.size,
      asks: ds.reduce((s, t) => s + t.asks, 0) + tuHoi.reduce((s, r) => s + Number(r.n), 0),
      newTours: ds.filter((t) => +t.firstAskedAt >= moiTu).length,
      topPlace: noi[0] ? { name: noi[0].name, askers: noi[0].askers, asks: noi[0].asks } : null,
    };
    if (q.view === 'place') {
      const loc = q.search?.trim() ? noi.filter((p) => khopTour({ name: p.name, code: null }, q.search!) > 0) : noi;
      return { summary, total: loc.length, items: loc.slice(q.skip, q.skip + q.take) };
    }
    // Gắn số đơn chốt, doanh thu; tour đã bán mà chưa ai ghim quan tâm cũng hiện (0 khách quan tâm).
    const chot = await this.chotTheoTour(user, q);
    for (const t of ds) Object.assign(t, chot.get(t.key) ?? { closed: 0, revenue: 0 });
    const coSan = new Set(ds.map((t) => t.key));
    for (const [key, c] of chot) {
      if (coSan.has(key)) continue;
      ds.push({ key, name: c.name, place: diaDiemTuTen(c.name), price: null, days: null, nights: null, image: null, askers: 0, asks: 0, bot: 0, tag: 0, firstAskedAt: new Date(0), lastAskedAt: new Date(0), rank: 0, khach: new Map(), closed: c.closed, revenue: c.revenue });
    }
    const sort = q.sort ?? 'askers';
    if (sort !== 'askers') {
      const gt = (t: Tour) => (sort === 'revenue' ? (t.revenue ?? 0) : (t.closed ?? 0));
      ds.sort((a, b) => gt(b) - gt(a) || b.askers - a.askers);
      ds.forEach((t, i) => (t.rank = i > 0 && gt(ds[i - 1]) === gt(t) ? ds[i - 1].rank : i + 1));
    } else {
      ds.sort((a, b) => b.askers - a.askers || +b.lastAskedAt - +a.lastAskedAt);
      ds.forEach((t, i) => (t.rank = i > 0 && ds[i - 1].askers === t.askers ? ds[i - 1].rank : i + 1));
    }
    const loc = ds.filter((t) => (!q.moi || +t.firstAskedAt >= moiTu) && (!q.search?.trim() || khopTour({ name: t.name, code: null }, q.search) > 0));
    return { summary, total: loc.length, items: loc.slice(q.skip, q.skip + q.take).map(TourInterestService.ra) };
  }

  /**
   * Theo địa điểm: khách đếm một lần trong địa điểm dù hỏi nhiều tour. Gộp chung (chủ dự án chốt 2026-11-13) nhãn sale ghim
   * với địa điểm khách tự hỏi; tên địa điểm so theo chữ bỏ dấu để "Trung Quốc" của danh mục và của máy nhận ra là một.
   */
  private theoNoi(ds: Tour[], tuHoi: { cid: string; place: string; n: bigint }[] = []) {
    const m = new Map<string, { name: string; khach: Set<string>; asks: number; tours: Tour[] }>();
    const lay = (ten: string) => {
      const k = khoaTour(ten);
      let p = m.get(k);
      if (!p) m.set(k, (p = { name: ten, khach: new Set<string>(), asks: 0, tours: [] }));
      return p;
    };
    for (const t of ds) {
      const p = lay(t.place ?? 'Địa điểm khác');
      t.khach.forEach((_, cid) => p.khach.add(cid));
      p.asks += t.asks;
      p.tours.push(t);
    }
    for (const r of tuHoi) {
      const p = lay(r.place);
      p.khach.add(r.cid);
      p.asks += Number(r.n);
    }
    // Chủ dự án đổi 2026-11-13: bảng địa điểm không hiện tour con, chỉ số lượt hỏi và phần trăm trên tổng lượt; bấm "Xem thống kê" để xem tin nhắn.
    const tong = [...m.values()].reduce((s, p) => s + p.asks, 0);
    const noi = [...m.values()].map((p) => ({ key: khoaTour(p.name), name: p.name, askers: p.khach.size, asks: p.asks, share: tong ? p.asks / tong : 0, tours: p.tours.length, rank: 0 }));
    noi.sort((a, b) => b.asks - a.asks || b.askers - a.askers);
    noi.forEach((p, i) => (p.rank = i > 0 && noi[i - 1].asks === p.asks ? noi[i - 1].rank : i + 1));
    return noi;
  }

  /**
   * Hộp "Xem thống kê" của một địa điểm: từng tin nhắn đã được tính (máy nhận ra trong tin khách, hoặc tin sale ghim tour thuộc địa điểm đó),
   * mới nhất trước. `key` là tên địa điểm bỏ dấu (trường `key` của bảng địa điểm).
   */
  async placeMessages(user: AuthUser, key: string, bo: Bo) {
    const pham = sqlPhamHoiThoai(phamViPhong(user));
    const tu = bo.tu ? Prisma.sql`AND p."createdAt" >= ${bo.tu}` : Prisma.empty;
    const kenh = bo.kenh ? Prisma.sql`AND c.channel::text = ${bo.kenh}` : Prisma.empty;
    type Dong = { conv_id: string; message_id: string | null; cid: string; name: string; phone: string | null; ch: string; at: Date; text: string | null; place: string; tour: string | null; by_name: string | null };
    const tuHoi = await this.prisma.$queryRaw<Dong[]>`
      SELECT p."conversationId" AS conv_id, p."messageId" AS message_id, p."customerId" AS cid, cu.name, cu.phone, c.channel::text AS ch,
             p."createdAt" AS at, m.text, p.place, NULL::text AS tour, NULL::text AS by_name
      FROM place_interests p
      JOIN conversations c ON c.id = p."conversationId"
      JOIN customers cu ON cu.id = p."customerId"
      LEFT JOIN messages m ON m.id = p."messageId"
      WHERE lower(btt_bo_dau(p.place)) = ${key} AND ${pham} ${tu} ${kenh}
      ORDER BY p."createdAt" DESC LIMIT 2000`;
    // Nhãn sale ghim: địa điểm của tour tính như bảng xếp hạng (danh mục website, nhóm tour, rồi tên tour).
    const keys = (await this.tours(user, bo)).filter((t) => khoaTour(t.place ?? 'Địa điểm khác') === key).map((t) => t.key);
    const ghim = keys.length
      ? await this.prisma.$queryRaw<Dong[]>`
          WITH e AS (${this.suKien(user, bo)})
          SELECT e.conv_id, e.msg_id AS message_id, e.cid, cu.name, cu.phone, e.ch, e.at, m.text, NULL::text AS place, e.name AS tour, u."fullName" AS by_name
          FROM e JOIN customers cu ON cu.id = e.cid
          LEFT JOIN messages m ON m.id = e.msg_id
          LEFT JOIN users u ON u.id = e.by_id
          WHERE lower(btt_bo_dau(e.name)) IN (${Prisma.join(keys)})
          ORDER BY e.at DESC LIMIT 2000`
      : [];
    return [...tuHoi, ...ghim]
      .sort((a, b) => +b.at - +a.at)
      .slice(0, 2000)
      .map((r) => ({
        conversationId: r.conv_id, messageId: r.message_id, customerId: r.cid, name: r.name, phone: r.phone, channel: r.ch, at: r.at,
        text: r.text ?? '', source: r.tour ? ('TAG' as const) : ('AUTO' as const), tour: r.tour, by: r.by_name,
      }));
  }

  /**
   * Quét lại tin khách đã có của một hội thoại để nhận địa điểm (tin kéo về từ Zalo, tin trước khi có tính năng).
   * Đi từ tin cũ nhất, theo giờ của từng tin: mỗi khách mỗi địa điểm mỗi ngày chỉ tính một lượt (khoá duy nhất bỏ qua lượt trùng).
   */
  async quetHoiThoai(conversationId: string): Promise<number> {
    const c = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { customerId: true } });
    if (!c) return 0;
    const tin = await this.prisma.message.findMany({
      where: { conversationId, senderType: 'CUSTOMER', internal: false, text: { not: '' } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, text: true, createdAt: true },
      take: 20000,
    });
    const data: Prisma.PlaceInterestCreateManyInput[] = [];
    const daCo = new Set<string>();
    for (const m of tin) {
      for (const place of timDiaDiem(m.text ?? '')) {
        const day = ngayVN(m.createdAt);
        if (daCo.has(`${place}|${day}`)) continue;
        daCo.add(`${place}|${day}`);
        data.push({ conversationId, customerId: c.customerId, messageId: m.id, place, day, createdAt: m.createdAt });
      }
    }
    if (!data.length) return 0;
    const r = await this.prisma.placeInterest.createMany({ data, skipDuplicates: true });
    return r.count;
  }

  /** Admin bấm "Quét tin nhắn cũ" ở trang Nhu cầu tour: quét mọi hội thoại, mỗi lần 200. */
  async quetTatCa(): Promise<{ hoiThoai: number; luotMoi: number }> {
    let hoiThoai = 0;
    let luotMoi = 0;
    let sau: string | undefined;
    for (;;) {
      const ds = await this.prisma.conversation.findMany({ select: { id: true }, orderBy: { id: 'asc' }, take: 200, ...(sau ? { cursor: { id: sau }, skip: 1 } : {}) });
      if (!ds.length) break;
      for (const c of ds) {
        luotMoi += await this.quetHoiThoai(c.id);
        hoiThoai++;
      }
      sau = ds[ds.length - 1].id;
    }
    this.log.log(`Quét địa điểm tin cũ: ${hoiThoai} hội thoại, ${luotMoi} lượt mới`);
    return { hoiThoai, luotMoi };
  }

  /** Hộp "Thống kê tour": tổng quan một tour trong phạm vi và kỳ đang chọn. */
  async detail(user: AuthUser, key: string, bo: Bo) {
    const ds = await this.tours(user, bo);
    const t = ds.find((x) => x.key === key);
    if (!t) throw new NotFoundException('Không có lượt quan tâm cho tour này trong kỳ đã chọn');
    const pham = sqlPhamHoiThoai(phamViPhong(user));
    const tuDeal = bo.tu ? Prisma.sql`AND d."closedAt" >= ${bo.tu}` : Prisma.empty;
    const kenhDeal = bo.kenh ? Prisma.sql`AND c.channel::text = ${bo.kenh}` : Prisma.empty;
    const [[chot], ngay, sale] = await Promise.all([
      this.prisma.$queryRaw<{ n: bigint; tien: bigint | null }[]>`
        SELECT COUNT(*) AS n, SUM(d.amount) AS tien FROM deals d JOIN conversations c ON c.id = d."conversationId"
        WHERE d.status = 'CONFIRMED' AND d."voidedAt" IS NULL AND lower(btt_bo_dau(d."tourName")) = ${key} AND ${pham} ${tuDeal} ${kenhDeal}`,
      // 7 ngày gần nhất theo giờ Việt Nam, kể cả ngày không có lượt nào.
      this.prisma.$queryRaw<{ d: string; n: bigint }[]>`
        WITH e AS (${this.suKien(user, { kenh: bo.kenh, tu: new Date(Date.now() - 8 * 86_400_000) }, key)})
        SELECT to_char(g.d, 'YYYY-MM-DD') AS d, COUNT(e.at) AS n
        FROM generate_series((now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 6, (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, interval '1 day') g(d)
        LEFT JOIN e ON (e.at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = g.d::date
        GROUP BY g.d ORDER BY g.d`,
      this.prisma.$queryRaw<{ name: string | null; dept: string | null; n: bigint }[]>`
        WITH e AS (${this.suKien(user, bo, key)})
        SELECT u."fullName" AS name, dp.name AS dept, COUNT(*) AS n FROM e
        LEFT JOIN users u ON u.id = e.by_id LEFT JOIN departments dp ON dp.id = u."departmentId"
        WHERE e.src = 'TAG' GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 3`,
    ]);
    const kenh: Record<string, number> = {};
    t.khach.forEach((ch) => (kenh[ch] = (kenh[ch] ?? 0) + 1));
    const daChot = Number(chot?.n ?? 0);
    return {
      ...TourInterestService.ra(t),
      totalTours: ds.length,
      newCustomers7d: await this.khachMoi(user, key, bo),
      closed: daChot,
      revenue: Number(chot?.tien ?? 0),
      closeRate: t.askers ? daChot / t.askers : 0,
      daily: ngay.map((r) => ({ date: r.d, count: Number(r.n) })),
      channels: kenh,
      topTaggers: sale.map((s) => ({ name: s.name ?? 'Nhân viên đã nghỉ', department: s.dept, count: Number(s.n) })),
    };
  }

  /** Khách lần đầu quan tâm tour này trong 7 ngày qua. */
  private async khachMoi(user: AuthUser, key: string, bo: Bo) {
    const [r] = await this.prisma.$queryRaw<{ n: bigint }[]>`
      WITH e AS (${this.suKien(user, { kenh: bo.kenh }, key)})
      SELECT COUNT(*) AS n FROM (SELECT cid FROM e GROUP BY cid HAVING MIN(at) >= now() - interval '7 days') x`;
    return Number(r?.n ?? 0);
  }

  /**
   * Khách quan tâm một tour: mỗi khách một mục, mỗi lượt một dòng (Lần 1, Lần 2...).
   * Thẻ bot: tin của khách ngay trước thẻ. Nhãn sale: đúng tin đã ghim và người gắn.
   */
  async askers(user: AuthUser, key: string, bo: Bo = {}) {
    type A = { cid: string; conv_id: string; name: string; phone: string | null; ch: string; at: Date; src: 'BOT' | 'TAG'; message_id: string | null; text: string | null; msg_at: Date | null; by_name: string | null };
    const rows = await this.prisma.$queryRaw<A[]>`
      WITH e AS (${this.suKien(user, bo, key)})
      SELECT DISTINCT ON (e.src, e.ev_id) e.cid, e.conv_id, cu.name, cu.phone, e.ch, e.at, e.src,
             COALESCE(pin.id, q.id) AS message_id, COALESCE(pin.text, q.text) AS text, COALESCE(pin."createdAt", q."createdAt") AS msg_at, u."fullName" AS by_name
      FROM e
      JOIN customers cu ON cu.id = e.cid
      LEFT JOIN messages pin ON pin.id = e.msg_id
      LEFT JOIN users u ON u.id = e.by_id
      LEFT JOIN LATERAL (
        SELECT id, text, "createdAt" FROM messages
        WHERE e.src = 'BOT' AND "conversationId" = e.conv_id AND "senderType" = 'CUSTOMER' AND "createdAt" <= e.at
        ORDER BY "createdAt" DESC LIMIT 1
      ) q ON TRUE
      ORDER BY e.src, e.ev_id
      LIMIT 5000`;
    type Lan = { messageId: string | null; conversationId: string; text: string; at: Date; source: 'BOT' | 'TAG'; by: string | null; time: number };
    const theoKhach = new Map<string, { customerId: string; name: string; phone: string | null; channel: string; lastAskedAt: Date; asks: Lan[] }>();
    for (const r of rows) {
      let k = theoKhach.get(r.cid);
      if (!k) theoKhach.set(r.cid, (k = { customerId: r.cid, name: r.name, phone: r.phone, channel: r.ch, lastAskedAt: r.at, asks: [] }));
      if (r.at > k.lastAskedAt) k.lastAskedAt = r.at;
      k.asks.push({ messageId: r.message_id, conversationId: r.conv_id, text: r.text ?? '', at: r.at, source: r.src, by: r.by_name, time: 0 });
    }
    return [...theoKhach.values()]
      .map((k) => {
        const asks = k.asks.sort((a, b) => +a.at - +b.at).map((a, i) => ({ ...a, time: i + 1 }));
        return { ...k, asks: asks.reverse() };
      })
      .sort((a, b) => +b.lastAskedAt - +a.lastAskedAt);
  }
}
