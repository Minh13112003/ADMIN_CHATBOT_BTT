import { Granularity, seriesBuckets, seriesEnd } from './stats-series';

/** Kỳ của trang Thống kê mới: 7 ngày và 30 ngày hiện theo ngày, quý (13 tuần) hiện theo tuần. */
export type BoardRange = '7d' | '30d' | 'quarter';

const VN_MS = 7 * 3600_000;

/** Mốc của kỳ đang xem và kỳ liền trước cùng độ dài (để so sánh "so với kỳ trước"). */
export function khoangBoard(range: BoardRange, now = new Date()) {
  const granularity: Granularity = range === 'quarter' ? 'week' : 'day';
  const n = range === '7d' ? 7 : range === '30d' ? 30 : 13;
  const buckets = seriesBuckets(granularity, n, now);
  const from = new Date(buckets[0].start);
  const to = seriesEnd(granularity, buckets[n - 1].start);
  const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
  return { granularity, buckets, from, to, prevFrom };
}

/** Vị trí mốc chứa thời điểm t (mốc cuối có start <= t), -1 nếu nằm ngoài. */
export function viTriMoc(starts: number[], end: number, t: number) {
  if (t < starts[0] || t >= end) return -1;
  let lo = 0;
  let hi = starts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (starts[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** Chia giá trị vào các khoảng [edges[i], edges[i+1]); khoảng cuối không có trần. */
export function demTheoKhoang(values: number[], edges: number[]) {
  const counts = edges.map(() => 0);
  for (const v of values) {
    let i = edges.length - 1;
    while (i > 0 && v < edges[i]) i--;
    if (v >= edges[0]) counts[i]++;
  }
  return counts;
}

/** Trung vị, null khi rỗng. */
export function trungVi(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Thứ (0 = Thứ 2 … 6 = Chủ nhật) và giờ theo giờ Việt Nam. */
export function thuGioVN(t: Date) {
  const vn = new Date(t.getTime() + VN_MS);
  return { thu: (vn.getUTCDay() + 6) % 7, gio: vn.getUTCHours() };
}

/** 8 tuần tới tính từ thứ Hai tuần này (giờ VN), để vẽ lịch khởi hành sắp tới. Trả về mốc dạng YYYY-MM-DD. */
export function tuanSapToi(now = new Date(), n = 8) {
  const vn = new Date(now.getTime() + VN_MS);
  const monday = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() - ((vn.getUTCDay() + 6) % 7));
  return Array.from({ length: n + 1 }, (_, i) => new Date(monday + i * 7 * 86400_000).toISOString().slice(0, 10));
}
