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
  { ten: 'Trung Quốc', manh: ['trung quoc', 'trung hoa', 'bac kinh', 'thuong hai', 'shanghai', 'truong gia gioi', 'phuong hoang co tran', 'cuu trai cau', 'le giang', 'tay tang', 'shangri la', 'thanh do', 'quang chau', 'tham quyen', 'con minh'], yeu: ['tq', 'tau', 'trung', 'china'] },
  { ten: 'Nhật Bản', manh: ['nhat ban', 'tokyo', 'osaka', 'kyoto', 'hokkaido', 'sapporo', 'phu si', 'fuji', 'japan', 'xu phu tang'], yeu: ['nhat', 'jp', 'nb'] },
  { ten: 'Hàn Quốc', manh: ['han quoc', 'seoul', 'nami', 'everland', 'jeju', 'busan', 'korea', 'xu kim chi'], yeu: ['han', 'hq'] },
  { ten: 'Đài Loan', manh: ['dai loan', 'dai bac', 'taipei', 'cao hung', 'kaohsiung', 'dai trung', 'taiwan'], yeu: ['dl'] }, // Không thêm "đài": "tour dài ngày" bỏ dấu thành "tour dai".
  { ten: 'Hồng Kông', manh: ['hong kong', 'hongkong', 'huong cang', 'ma cao', 'macau', 'macao'], yeu: ['hk'] },
  { ten: 'Thái Lan', manh: ['thai lan', 'bangkok', 'pattaya', 'phuket', 'chiang mai', 'chiang rai', 'thailand'], yeu: ['thai'] },
  { ten: 'Singapore', manh: ['singapore', 'sing', 'xin ga po', 'singapo', 'sentosa', 'dao quoc su tu'] },
  { ten: 'Malaysia', manh: ['malaysia', 'malay', 'ma lai', 'kuala lumpur', 'genting', 'penang'], yeu: ['kl'] },
  { ten: 'Indonesia', manh: ['indonesia', 'indo', 'bali', 'jakarta', 'yogyakarta', 'borobudur', 'nam dao'] },
  { ten: 'Campuchia', manh: ['campuchia', 'cam pu chia', 'siem reap', 'angkor', 'phnom penh', 'nam vang'] },
  { ten: 'Lào', manh: ['luang prabang', 'vientiane', 'vien chan', 'nuoc lao'], yeu: ['lao'] },
  { ten: 'Philippines', manh: ['philippines', 'philippin', 'manila', 'boracay'] },
  { ten: 'Ấn Độ', manh: ['an do', 'india', 'new delhi'] },
  { ten: 'Maldives', manh: ['maldives', 'maldive', 'madives'] },
  { ten: 'Sri Lanka', manh: ['sri lanka', 'srilanka'] },
  { ten: 'Pakistan', manh: ['pakistan', 'hunza', 'skardu'] },
  { ten: 'Dubai', manh: ['dubai', 'abu dhabi', 'uae', 'a rap'] },
  { ten: 'Thổ Nhĩ Kỳ', manh: ['tho nhi ky', 'istanbul', 'turkey', 'cappadocia'] },
  { ten: 'Ai Cập', manh: ['ai cap', 'egypt', 'cairo'] },
  { ten: 'Phần Lan / Bắc Âu', manh: ['phan lan', 'finland', 'lapland', 'rovaniemi', 'helsinki', 'na uy', 'thuy dien', 'dan mach', 'iceland', 'bac au', 'bac cuc quang'] },
  { ten: 'Châu Âu', manh: ['chau au', 'paris', 'france', 'eiffel', 'thuy si', 'switzerland', 'swiss', 'italy', 'nuoc y', 'ha lan', 'tay ban nha', 'anh quoc', 'nuoc anh', 'london', 'england', 'scotland', 'dong au', 'balkan', 'balkans', 'croatia', 'hungary', 'europe'], yeu: ['phap', 'duc', 'y', 'uk', 'au'] },
  { ten: 'Nga', manh: ['moscow', 'mat xco va', 'matxcova', 'saint petersburg', 'murmansk', 'russia', 'nuoc nga'], yeu: ['nga'] },
  { ten: 'Úc', manh: ['australia', 'sydney', 'melbourne', 'nuoc uc', 'blue mountains'], yeu: ['uc'] },
  { ten: 'New Zealand', manh: ['new zealand', 'newzealand', 'tan tay lan', 'auckland', 'hobbiton'], yeu: ['nz'] },
  { ten: 'Mỹ', manh: ['hoa ky', 'new york', 'los angeles', 'las vegas', 'san francisco', 'hawaii'], yeu: ['my', 'usa'] },
  { ten: 'Canada', manh: ['canada'] },
  { ten: 'Mông Cổ', manh: ['mong co', 'mongolia'] },
  { ten: 'Đà Lạt', manh: ['da lat', 'dalat', 'bao loc', 'ta dung'] },
  { ten: 'Phú Quốc', manh: ['phu quoc', 'phuquoc', 'ha tien', 'nam du'], yeu: ['pq'] },
  { ten: 'Đà Nẵng', manh: ['da nang', 'danang', 'ba na', 'hoi an', 'son tra', 'cu lao cham'], yeu: ['dn'] },
  { ten: 'Nha Trang', manh: ['nha trang', 'cam ranh', 'binh ba'] },
  { ten: 'Ninh Thuận', manh: ['ninh thuan', 'phan rang', 'vinh hy'] },
  { ten: 'Hà Nội', manh: ['ha noi', 'mien bac', 'yen tu'], yeu: ['hn'] },
  { ten: 'Hạ Long', manh: ['ha long', 'halong', 'cat ba', 'hai phong', 'co to'] },
  { ten: 'Sapa', manh: ['sapa', 'sa pa', 'fansipan'] },
  { ten: 'Hà Giang', manh: ['ha giang', 'cao bang'] },
  { ten: 'Huế', manh: ['co do hue'], yeu: ['hue'] },
  { ten: 'Quy Nhơn', manh: ['quy nhon', 'qui nhon', 'eo gio', 'ky co', 'binh dinh'] },
  { ten: 'Côn Đảo', manh: ['con dao'] },
  { ten: 'Vũng Tàu', manh: ['vung tau', 'ho tram'] },
  { ten: 'Tây Ninh', manh: ['tay ninh', 'nui ba den'] },
  { ten: 'Tây Nguyên', manh: ['tay nguyen', 'buon ma thuot', 'dak lak', 'pleiku', 'kon tum'] },
  { ten: 'Miền Tây', manh: ['mien tay', 'mekong', 'can tho', 'chau doc', 'ben tre', 'ca mau', 'bac lieu', 'dong thap', 'an giang', 'tien giang'] },
  { ten: 'Phan Thiết', manh: ['phan thiet', 'mui ne'] },
  { ten: 'Ninh Bình', manh: ['ninh binh', 'trang an', 'tam coc', 'bai dinh'] },
  { ten: 'Tây Bắc', manh: ['tay bac', 'moc chau', 'mu cang chai', 'dien bien'] },
  { ten: 'Phú Yên', manh: ['phu yen'] },
  { ten: 'Lý Sơn', manh: ['ly son'] },
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
const CAP_BO = [
  'qua han', 'di han', 'den han', 'toi han', 'qua my', 'di y', 'qua y', 'den y', 'toi y',
  // "quá ẩu", "đi ngã", "quá ức"...: các tên này chỉ tính khi đứng sau "tour", "du lịch", "sang".
  'qua au', 'di au', 'den au', 'toi au', 'qua uc', 'qua nga', 'di nga', 'den nga', 'toi nga',
];

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
