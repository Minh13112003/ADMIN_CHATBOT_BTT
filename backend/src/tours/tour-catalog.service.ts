import { BadGatewayException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chonDiaDiem, khopTour, laMaDot, tienToMaDot, type CategoryRef } from '../common/tours';

/** Một tour trong danh mục (mọi ngày khởi hành chung một tour). Giá, mã, ngày là của đợt gần nhất. */
export type CatalogTour = {
  key: string;
  code: string | null;
  name: string;
  image: string | null;
  days: number | null;
  nights: number | null;
  price: number | null;
  departureDate: string | null;
  categoryIds: number[];
  place: CategoryRef | null;
};

export type TourDay = { id: string; code: string; departureDate: string; returnDate: string | null; price: number; stock: number | null; available: boolean };
export type TourDetail = CatalogTour & { tourDays: TourDay[] };

type Catalog = { at: number; tours: Map<string, CatalogTour>; places: (CategoryRef & { tours: number })[] };

const DANH_MUC_MS = 60 * 60_000;
const CHI_TIET_MS = 15 * 60_000;

/**
 * Danh mục tour lấy từ API benthanhtourist.com (docs/tour-api.md), lưu tạm trong bộ nhớ 1 giờ.
 * Trình duyệt không gọi thẳng API ngoài. API hỏng thì dùng tiếp bản cũ nếu có.
 */
@Injectable()
export class TourCatalogService {
  private log = new Logger('TourCatalog');
  private catalog: Catalog | null = null;
  private dangTai: Promise<Catalog> | null = null;
  private chiTiet = new Map<string, { at: number; data: TourDetail }>();

  constructor(private config: ConfigService) {}

  private get base() {
    return (this.config.get<string>('TOUR_API_URL') || 'https://benthanhtourist.com/api/tour').replace(/\/$/, '');
  }

  private async goi<T>(path: string): Promise<T> {
    // Thiếu Accept: application/json thì máy chủ trả 302 về trang chủ.
    const res = await fetch(`${this.base}${path}`, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`${path} trả mã ${res.status}`);
    const j = (await res.json()) as { error?: boolean } & T;
    if (j.error) throw new Error(`${path} báo lỗi`);
    return j;
  }

  private static tour(r: Record<string, unknown>): Omit<CatalogTour, 'categoryIds' | 'place'> {
    const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() && !Number.isNaN(Number(v)) ? Number(v) : null);
    return {
      key: String(r.id),
      code: typeof r.code === 'string' ? r.code : null,
      name: String(r.name ?? 'Tour'),
      image: typeof r.image === 'string' ? r.image : null,
      days: num(r.days),
      nights: num(r.nights),
      price: num(r.price),
      departureDate: typeof r.departure_date === 'string' ? r.departure_date : null,
    };
  }

  private async taiDanhMuc(): Promise<Catalog> {
    const cats = (await this.goi<{ data: { hash: number; name: string }[] }>('/categories')).data;
    const ten = new Map(cats.map((c) => [Number(c.hash), c.name]));
    const tours = new Map<string, Omit<CatalogTour, 'categoryIds' | 'place'>>();
    const thuoc = new Map<string, number[]>();
    const soTour = new Map<number, number>();
    // Khoảng 120 thể loại, mỗi thể loại 1-5 trang; chạy 4 luồng để không dồn máy chủ website.
    const hang = [...ten.keys()];
    const chay = async () => {
      for (let id = hang.shift(); id !== undefined; id = hang.shift()) {
        let trang = 1;
        let cuoi = 1;
        let dem = 0;
        do {
          const r = await this.goi<{ data: Record<string, unknown>[]; meta?: { last_page?: number } }>(`/category?category_id=${id}&page=${trang}`);
          cuoi = Math.min(r.meta?.last_page ?? 1, 30);
          for (const row of r.data ?? []) {
            const t = TourCatalogService.tour(row);
            if (!tours.has(t.key)) tours.set(t.key, t);
            const ds = thuoc.get(t.key) ?? [];
            if (!ds.includes(id)) ds.push(id);
            thuoc.set(t.key, ds);
            dem++;
          }
          trang++;
        } while (trang <= cuoi);
        soTour.set(id, dem);
      }
    };
    await Promise.all([chay(), chay(), chay(), chay()]);
    const ketQua = new Map<string, CatalogTour>();
    const demNoi = new Map<number, number>();
    for (const [key, t] of tours) {
      const categoryIds = thuoc.get(key) ?? [];
      const place = chonDiaDiem(categoryIds, soTour, ten);
      if (place) demNoi.set(place.id, (demNoi.get(place.id) ?? 0) + 1);
      ketQua.set(key, { ...t, categoryIds, place });
    }
    const places = [...demNoi].map(([id, n]) => ({ id, name: ten.get(id) ?? '', tours: n })).sort((a, b) => b.tours - a.tours || a.name.localeCompare(b.name, 'vi'));
    this.log.log(`Tải danh mục tour: ${ketQua.size} tour, ${places.length} địa điểm`);
    return { at: Date.now(), tours: ketQua, places };
  }

  /** Danh mục còn hạn thì dùng ngay; hết hạn mà đang có bản cũ thì trả bản cũ và tải lại phía sau. */
  async danhMuc(): Promise<Catalog> {
    const cu = this.catalog;
    if (cu && Date.now() - cu.at < DANH_MUC_MS) return cu;
    if (!this.dangTai) {
      this.dangTai = this.taiDanhMuc()
        .then((c) => (this.catalog = c))
        .finally(() => (this.dangTai = null));
    }
    if (cu) {
      this.dangTai.catch((e) => this.log.warn(`Tải lại danh mục tour lỗi, dùng bản cũ: ${(e as Error).message}`));
      return cu;
    }
    try {
      return await this.dangTai;
    } catch (e) {
      this.log.error(`Không tải được danh mục tour: ${(e as Error).message}`);
      throw new BadGatewayException('Không tải được danh mục tour từ benthanhtourist.com, thử lại sau ít phút');
    }
  }

  async diaDiem() {
    return (await this.danhMuc()).places;
  }

  async tim(q: string, categoryId?: number, take = 40): Promise<(CatalogTour & { matchedDay?: TourDay })[]> {
    const { tours } = await this.danhMuc();
    const trongLoai = (t: CatalogTour) => categoryId === undefined || t.categoryIds.includes(categoryId);
    // Gõ đúng một mã đợt: trả đúng tour đó kèm ngày khởi hành để hộp Chốt tour chọn sẵn.
    if (laMaDot(q)) {
      const thay = await this.theoMaDot(q);
      if (thay && trongLoai(thay.tour)) {
        const { tourDays: _, ...tour } = thay.tour;
        return [{ ...tour, matchedDay: thay.day }];
      }
    }
    const kq: CatalogTour[] = [...tours.values()].filter((t) => trongLoai(t) && khopTour(t, q) > 0);
    return kq.sort((a, b) => khopTour(b, q) - khopTour(a, q) || a.name.localeCompare(b.name, 'vi')).slice(0, take);
  }

  async chiTietTour(key: string): Promise<TourDetail> {
    const cache = this.chiTiet.get(key);
    if (cache && Date.now() - cache.at < CHI_TIET_MS) return cache.data;
    const { tours } = await this.danhMuc();
    let r: { data: Record<string, unknown> };
    try {
      r = await this.goi<{ data: Record<string, unknown> }>(`/item?tour_key=${encodeURIComponent(key)}`);
    } catch (e) {
      if (cache) return cache.data;
      this.log.warn(`Chi tiết tour ${key} lỗi: ${(e as Error).message}`);
      throw new NotFoundException('Không tải được tour này từ benthanhtourist.com');
    }
    const d = r.data;
    if (!d || !d.id) throw new NotFoundException('Không tìm thấy tour');
    const trongDanhMuc = tours.get(key);
    // Ngày khởi hành gần nhất nằm ở cấp gốc; tour_days chỉ chứa các ngày còn lại.
    const ngay = [d, ...(Array.isArray(d.tour_days) ? (d.tour_days as Record<string, unknown>[]) : [])];
    const data: TourDetail = {
      ...TourCatalogService.tour(d),
      key,
      categoryIds: trongDanhMuc?.categoryIds ?? [],
      place: trongDanhMuc?.place ?? null,
      tourDays: ngay
        .filter((x) => typeof x.code === 'string' && x.price !== undefined)
        .map((x) => ({
          id: String(x.id),
          code: String(x.code).toUpperCase(),
          departureDate: String(x.departure_date ?? ''),
          returnDate: typeof x.destination_date === 'string' ? x.destination_date : null,
          price: Number(x.price) || 0,
          stock: typeof x.stock_qty === 'number' ? x.stock_qty : null,
          available: x.is_available !== false,
        }))
        .filter((x, i, arr) => arr.findIndex((y) => y.code === x.code) === i)
        .sort((a, b) => a.departureDate.localeCompare(b.departureDate)),
    };
    this.chiTiet.set(key, { at: Date.now(), data });
    if (this.chiTiet.size > 500) this.chiTiet.delete(this.chiTiet.keys().next().value!);
    return data;
  }

  /**
   * Tìm tour theo mã đợt bất kỳ (không chỉ đợt gần nhất). Danh mục chỉ có mã đợt gần nhất nên phải tải chi tiết
   * các tour cùng phần đầu mã; phần đầu không duy nhất nên vẫn so khớp đúng mã trong tour_days.
   */
  async theoMaDot(raw: string): Promise<{ tour: TourDetail; day: TourDay } | null> {
    const code = raw.trim().toUpperCase();
    const { tours } = await this.danhMuc();
    const tienTo = tienToMaDot(code);
    const ungVien = [...tours.values()].filter((t) => t.code?.toUpperCase() === code || (tienTo && t.code && tienToMaDot(t.code) === tienTo));
    ungVien.sort((a, b) => Number(b.code?.toUpperCase() === code) - Number(a.code?.toUpperCase() === code));
    for (const t of ungVien.slice(0, 15)) {
      const ct = await this.chiTietTour(t.key).catch(() => null);
      const day = ct?.tourDays.find((d) => d.code === code);
      if (ct && day) return { tour: ct, day };
    }
    return null;
  }
}
