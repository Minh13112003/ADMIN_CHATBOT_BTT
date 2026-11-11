// Hàm thuần cho danh mục tour lấy từ API benthanhtourist.com (xem docs/tour-api.md). Có test ở tours.spec.ts.
import { boDau } from './text';

export type CategoryRef = { id: number; name: string };

/**
 * Địa điểm của một tour: thể loại cụ thể nhất chứa tour, tức thể loại có ít tour nhất.
 * API không trả quan hệ cha - con, nhưng nhóm lớn (Nước Ngoài, Châu Á) luôn nhiều tour hơn quốc gia (Đài Loan).
 * Bằng nhau thì lấy thể loại có số lớn hơn (thể loại tạo sau, thường cụ thể hơn).
 */
export function chonDiaDiem(categoryIds: number[], soTour: Map<number, number>, ten: Map<number, string>): CategoryRef | null {
  let tot: number | null = null;
  for (const id of categoryIds) {
    if (tot === null) { tot = id; continue; }
    const a = soTour.get(id) ?? Infinity;
    const b = soTour.get(tot) ?? Infinity;
    if (a < b || (a === b && id > tot)) tot = id;
  }
  return tot === null ? null : { id: tot, name: ten.get(tot) ?? '' };
}

/** Đoạn ngày khởi hành trong mã đợt: 6 chữ số ddmmyy. */
const DOAN_NGAY = /^\d{6}$/;

/** Mã đợt khởi hành dạng A06.FIT.CN.200127.A: các đoạn chữ số ngăn bởi dấu chấm, có đoạn ngày 6 số. */
export function laMaDot(raw: string): boolean {
  const t = raw.trim().toUpperCase();
  if (!/^[A-Z0-9_-]+(\.[A-Z0-9_-]+){2,}$/.test(t)) return false;
  return t.split('.').some((p) => DOAN_NGAY.test(p));
}

/**
 * Phần đầu mã đợt, trước đoạn ngày: A06.FIT.CN.200127.A -> A06.FIT.CN.
 * Không duy nhất giữa các tour (business-rules), chỉ dùng để thu hẹp số tour cần tải chi tiết khi tìm một mã đợt.
 */
export function tienToMaDot(raw: string): string | null {
  const phan = raw.trim().toUpperCase().split('.');
  const i = phan.findIndex((p) => DOAN_NGAY.test(p));
  return i > 0 ? phan.slice(0, i).join('.') : null;
}

/**
 * Mức khớp chữ tìm với tour (0 = không khớp), để xếp kết quả:
 * 3 = mã đợt gần nhất chứa chữ gõ; 2 = tên có nguyên cụm, bắt đầu từ đầu một từ; 1 = mọi từ gõ là đầu một từ trong tên.
 * So đầu từ (bỏ dấu) để "o tran" ra "Ô Trấn" mà không ra mọi tên có chữ o hay "Tràng An".
 */
export function khopTour(tour: { name: string; code: string | null }, q: string): number {
  const t = q.trim();
  if (!t) return 1;
  if (tour.code && tour.code.toUpperCase().includes(t.toUpperCase())) return 3;
  const tuTen = boDau(tour.name).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const tuGo = boDau(t).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!tuGo.length) return 0;
  // Cụm liền nhau: các từ đầu khớp nguyên từ, từ cuối khớp đầu từ (đang gõ dở).
  for (let i = 0; i + tuGo.length <= tuTen.length; i++) {
    if (tuGo.every((w, j) => (j === tuGo.length - 1 ? tuTen[i + j].startsWith(w) : tuTen[i + j] === w))) return 2;
  }
  return tuGo.every((w) => tuTen.some((x) => x.startsWith(w))) ? 1 : 0;
}

/** Khoá gộp một tour: tên viết thường, bỏ dấu, gọn khoảng trắng. Giống lower(btt_bo_dau(...)) trong SQL. */
export function khoaTour(name: string): string {
  return boDau(name).toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Đoán địa điểm từ tên khi tour không còn trong danh mục website (tour cũ bot từng gửi):
 * "Du Lịch Trung Quốc (Tết 2027): Ô Trấn" -> "Trung Quốc". Không đoán được thì null.
 */
export function diaDiemTuTen(name: string): string | null {
  const m = name.match(/^\s*du\s+l[iị]ch\s+([^:(\-–,]+)/i);
  const t = m?.[1]?.trim();
  return t && t.length >= 2 && t.length <= 40 ? t : null;
}

/** Ngày dạng YYYY-MM-DD theo giờ Việt Nam -> thời điểm đầu ngày hoặc cuối ngày (UTC+7). */
export function ngayVietNam(ngay: string, cuoiNgay = false): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return null;
  const d = new Date(`${ngay}T${cuoiNgay ? '23:59:59.999' : '00:00:00.000'}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
