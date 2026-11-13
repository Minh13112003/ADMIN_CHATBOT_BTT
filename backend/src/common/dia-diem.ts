import { boDau } from './text';

/**
 * Nhận ra địa điểm du lịch khách hỏi trong một câu (chủ dự án chốt 2026-11-13): "tour TQ", "tour Tàu", "tour Trung" đều là Trung Quốc.
 * Chỉ cần địa điểm (để đẩy tour), không cần tour cụ thể.
 *
 * - `manh`: tên rõ ràng, khớp ở bất cứ đâu trong câu, chịu được gõ sai 1 ký tự với từ dài (vd "trung quoc" gõ "trung quco").
 * - `yeu`: tên ngắn, dễ nhầm (TQ, Tàu, Trung, Nhật, Hàn, Thái...) chỉ tính khi đứng ngay sau "tour", "du lịch", "đi", "sang", "qua"...
 *   để "anh Trung", "đi tàu hoả" không bị tính.
 */
type DiaDiem = { ten: string; manh: string[]; yeu?: string[] };

const DANH_SACH: DiaDiem[] = [
  { ten: 'Trung Quốc', manh: ['trung quoc', 'trung hoa', 'bac kinh', 'thuong hai', 'truong gia gioi', 'phuong hoang co tran', 'cuu trai cau', 'le giang', 'tay tang', 'shangri la', 'thanh do', 'quang chau', 'tham quyen', 'con minh'], yeu: ['tq', 'tau', 'trung', 'china'] },
  { ten: 'Nhật Bản', manh: ['nhat ban', 'tokyo', 'osaka', 'kyoto', 'hokkaido', 'phu si', 'fuji', 'japan'], yeu: ['nhat', 'jp'] },
  { ten: 'Hàn Quốc', manh: ['han quoc', 'seoul', 'nami', 'everland', 'jeju', 'busan', 'korea'], yeu: ['han', 'hq'] },
  { ten: 'Đài Loan', manh: ['dai loan', 'dai bac', 'taipei', 'cao hung', 'dai trung', 'taiwan'], yeu: ['dl'] },
  { ten: 'Hồng Kông', manh: ['hong kong', 'hongkong', 'huong cang', 'ma cao', 'macau', 'macao'], yeu: ['hk'] },
  { ten: 'Thái Lan', manh: ['thai lan', 'bangkok', 'pattaya', 'phuket', 'chiang mai', 'thailand'], yeu: ['thai'] },
  { ten: 'Singapore', manh: ['singapore', 'sing', 'xin ga po', 'singapo'] },
  { ten: 'Malaysia', manh: ['malaysia', 'ma lai', 'kuala lumpur', 'genting'] },
  { ten: 'Indonesia', manh: ['indonesia', 'bali', 'jakarta', 'nam dao'] },
  { ten: 'Campuchia', manh: ['campuchia', 'cam pu chia', 'siem reap', 'angkor', 'phnom penh', 'nam vang'] },
  { ten: 'Lào', manh: ['luang prabang', 'vientiane', 'vien chan', 'nuoc lao'], yeu: ['lao'] },
  { ten: 'Philippines', manh: ['philippines', 'philippin', 'manila', 'boracay'] },
  { ten: 'Ấn Độ', manh: ['an do', 'india', 'new delhi'] },
  { ten: 'Dubai', manh: ['dubai', 'abu dhabi', 'uae'] },
  { ten: 'Thổ Nhĩ Kỳ', manh: ['tho nhi ky', 'istanbul', 'turkey', 'cappadocia'] },
  { ten: 'Ai Cập', manh: ['ai cap', 'egypt', 'cairo'] },
  { ten: 'Châu Âu', manh: ['chau au', 'paris', 'thuy si', 'italy', 'ha lan', 'tay ban nha', 'anh quoc', 'london', 'bac au', 'dong au', 'europe'], yeu: ['phap', 'duc', 'y'] },
  { ten: 'Nga', manh: ['moscow', 'mat xco va', 'saint petersburg'], yeu: ['nga'] },
  { ten: 'Úc', manh: ['australia', 'sydney', 'melbourne'], yeu: ['uc'] },
  { ten: 'New Zealand', manh: ['new zealand', 'newzealand'] },
  { ten: 'Mỹ', manh: ['hoa ky', 'new york', 'los angeles', 'las vegas', 'san francisco'], yeu: ['my', 'usa'] },
  { ten: 'Canada', manh: ['canada'] },
  { ten: 'Mông Cổ', manh: ['mong co', 'mongolia'] },
  { ten: 'Đà Lạt', manh: ['da lat', 'dalat'] },
  { ten: 'Phú Quốc', manh: ['phu quoc'] },
  { ten: 'Đà Nẵng', manh: ['da nang', 'ba na', 'hoi an'] },
  { ten: 'Nha Trang', manh: ['nha trang'] },
  { ten: 'Hạ Long', manh: ['ha long', 'halong'] },
  { ten: 'Sapa', manh: ['sapa', 'sa pa', 'fansipan'] },
  { ten: 'Hà Giang', manh: ['ha giang'] },
  { ten: 'Huế', manh: ['co do hue'], yeu: ['hue'] },
  { ten: 'Quy Nhơn', manh: ['quy nhon', 'eo gio'] },
  { ten: 'Côn Đảo', manh: ['con dao'] },
  { ten: 'Miền Tây', manh: ['mien tay', 'can tho', 'chau doc', 'ben tre'] },
  { ten: 'Phan Thiết', manh: ['phan thiet', 'mui ne'] },
  { ten: 'Ninh Bình', manh: ['ninh binh', 'trang an', 'tam coc'] },
  { ten: 'Tây Bắc', manh: ['tay bac', 'moc chau', 'mu cang chai'] },
  { ten: 'Phú Yên', manh: ['phu yen'] },
  { ten: 'Quảng Bình', manh: ['quang binh', 'phong nha'] },
];

/** Từ đứng ngay trước tên ngắn để chắc là nói về chuyến đi. */
const TIEN_TO = ['tour', 'tua', 'du lich', 'di', 'sang', 'qua', 'den', 'toi', 'chuyen', 'lich trinh'];
/** Cụm thường gặp không phải địa điểm, dù đứng sau "đi", "qua"...: "đi tàu hoả", "đi trung tâm", "quá hạn", "đi lao động". */
const KHONG_PHAI = [
  'tau hoa', 'tau thuy', 'tau lua', 'tau cao toc', 'tau dien', 'tau bien', 'tau ngam', 'tau di', 'tau ve',
  'trung tam', 'trung thu', 'trung binh', 'trung gian', 'trung tuan', 'han che', 'han muc', 'han su dung', 'nhat dinh', 'nhat la', 'nhat nhat',
  'thai do', 'my pham', 'y te', 'y kien', 'nga ba', 'nga tu', 'lao dong', 'hue hong', 'duc ket', 'phap ly', 'uc che',
];
/** Cặp (từ trước, tên ngắn) không tính: "quá hạn", "qua mỹ phẩm"... */
const CAP_BO = ['qua han', 'di han', 'den han', 'toi han', 'qua my', 'di y', 'qua y', 'den y', 'toi y'];

const chuan = (t: string) => ` ${boDau(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Khoảng cách sửa chữ (có tính gõ đảo 2 ký tự liền nhau là 1 lỗi). */
function lech(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/** Cụm `bi` (đã chuẩn hoá, nhiều từ) có xuất hiện trong câu không; từ dài từ 5 ký tự cho phép sai 1 ký tự. */
function coCum(tu: string[], bi: string[]): number {
  for (let i = 0; i + bi.length <= tu.length; i++) {
    if (bi.every((w, j) => tu[i + j] === w || (w.length >= 5 && lech(tu[i + j], w, 1) <= 1))) return i;
  }
  return -1;
}

/** Tên ngắn `y` đứng ngay sau `p`, và không thuộc cụm từ thông thường (xem KHONG_PHAI, CAP_BO). */
function coTenNgan(c: string, p: string, y: string): boolean {
  if (CAP_BO.includes(`${p} ${y}`) && p !== 'tour' && p !== 'tua') return false;
  for (let i = c.indexOf(` ${p} ${y} `); i !== -1; i = c.indexOf(` ${p} ${y} `, i + 1)) {
    const sau = c.slice(i + p.length + 2);
    if (!KHONG_PHAI.some((k) => sau.startsWith(`${k} `))) return true;
  }
  return false;
}

/** Các địa điểm (tên chuẩn) khách nhắc tới trong câu, không trùng, theo thứ tự trong danh sách. */
export function timDiaDiem(text: string): string[] {
  if (!text) return [];
  const c = chuan(text.slice(0, 2000));
  const tu = c.trim().split(' ').filter(Boolean);
  const ra: string[] = [];
  for (const d of DANH_SACH) {
    const khop =
      // Từ ngắn (dưới 5 ký tự) phải khớp đúng nguyên từ; từ dài cho sai 1 ký tự.
      d.manh.some((m) => coCum(tu, m.split(' ')) >= 0) || (d.yeu ?? []).some((y) => TIEN_TO.some((p) => coTenNgan(c, p, y)));
    if (khop) ra.push(d.ten);
  }
  return ra;
}

/** Ngày theo giờ Việt Nam dạng YYYY-MM-DD: mỗi khách mỗi địa điểm chỉ tính một lượt trong một ngày (chủ dự án chốt 2026-11-13). */
export function ngayVN(luc: Date): string {
  return new Date(luc.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
