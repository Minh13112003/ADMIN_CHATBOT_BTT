// Hàm thuần xử lý tên, số điện thoại, câu đòi gặp nhân viên. Có test ở text.spec.ts.

export function boDau(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function tachTen(name: string): string[] {
  return boDau(name).toLowerCase().trim().split(/\s+/).filter(Boolean);
}

/** Đưa về dạng 0xxxxxxxxx, trả null nếu không phải số di động/cố định Việt Nam 10 chữ số. */
export function chuanHoaSoDienThoai(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  const local = digits.startsWith('+84') ? `0${digits.slice(3)}` : digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return /^0\d{9}$/.test(local) ? local : null;
}

/**
 * Cùng số điện thoại, tên có được coi là cùng một người không.
 * "Hoa", "Nguyễn Hoa", "Thị Hoa" đều khớp "Nguyễn Thị Hoa": một bên nằm trọn trong bên kia, hoặc cùng tên gọi (từ cuối).
 * "Tuấn" không khớp "Nguyễn Thị Hoa".
 */
export function cungMotNguoi(a: string, b: string): boolean {
  const ta = tachTen(a);
  const tb = tachTen(b);
  if (!ta.length || !tb.length) return false;
  if (ta[ta.length - 1] === tb[tb.length - 1]) return true;
  const [ngan, dai] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return ngan.every((t) => dai.includes(t));
}

/** Giữ bản tên đầy đủ nhất làm tên chính, các bản còn lại đưa vào aliases. */
export function gopTen(hienTai: string, aliases: string[], moi: string): { name: string; aliases: string[] } {
  const ten = moi.trim().replace(/\s+/g, ' ');
  const tatCa = [hienTai, ...aliases, ten];
  const name = tatCa.reduce((tot, x) => (tachTen(x).length > tachTen(tot).length ? x : tot), hienTai);
  const khac = new Map<string, string>();
  for (const x of tatCa) {
    const key = boDau(x).toLowerCase();
    if (key !== boDau(name).toLowerCase() && !khac.has(key)) khac.set(key, x);
  }
  return { name, aliases: [...khac.values()] };
}

// Khớp danh sách TU_KHOA_CAN_NHAN_VIEN trong D:\ChatBot\rules.py, so trên chữ đã bỏ dấu.
// Việc tiền/hợp đồng phức tạp (hoàn tiền của chính khách...) do chatbot tự nhận biết và gửi cờ wantsHuman.
const CUM_CAN_NHAN_VIEN = [
  'gap nhan vien', 'noi chuyen voi nguoi', 'noi chuyen voi nhan vien', 'noi chuyen truc tiep', 'nguoi that', 'gap nguoi',
  'nhan vien that', 'ket noi nhan vien', 'ket noi voi nhan vien', 'chuyen nhan vien', 'goi nhan vien', 'nhan vien ho tro',
  'tu van vien', 'nhan vien tu van', 'lien he nhan vien', 'lien he voi nhan vien', 'noi may nhan vien', 'khieu nai', 'phan nan',
  'khong hai long', 'tour toi da dat', 'tour da dat', 'da dat tour', 'dat tour roi', 'dat roi ma', 'thanh toan roi ma', 'su co',
  'bi lua', 'khong dung nhu', 'tai nan', 'khan cap', 'cap cuu', 'nhap vien', 'bi thuong', 'bi ket', 'lac doan', 'bi bo lai',
  'tre chuyen bay', 'cham chuyen bay', 'mat do', 'mat hanh ly', 'that lac', 'bo quen', 'mat ho chieu', 'mat passport',
  'mat giay to', 'mat vi', 'mat dien thoai', 'bi trom', 'bi cuop', 'moc tui',
];
const DONG_TU_GAP = /\b(gap|ket noi|noi may|noi chuyen|lien he|chuyen|goi|can|muon)\b.*\bnhan vien\b/;
// "Nhân viên hướng dẫn có đi cùng không" là câu tư vấn thường, không được coi là đòi gặp nhân viên.
const NHAN_VIEN_HUONG_DAN = /nhan vien huong dan/;

export function coCumTu(textBoDau: string, cum: string): boolean {
  const a = ` ${textBoDau.replace(/[^a-z0-9]+/g, ' ').trim()} `;
  return a.includes(` ${cum} `);
}

export function doiGapNhanVien(text: string): boolean {
  const t = boDau(text.normalize('NFC')).toLowerCase();
  if (NHAN_VIEN_HUONG_DAN.test(t)) return false;
  if (CUM_CAN_NHAN_VIEN.some((c) => coCumTu(t, c))) return true;
  return DONG_TU_GAP.test(t.replace(/[^a-z0-9]+/g, ' '));
}

export function tomTat(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Chữ gõ trong ô tìm kiếm -> các từ khoá, khách phải chứa đủ tất cả trong `customers.searchText`.
 * Cách bỏ dấu phải khớp hàm SQL `btt_bo_dau` (migration search_and_stats_indexes): gõ "nguyen hoa" vẫn ra "Nguyễn Thị Hoa".
 * Chỉ gồm số và ký tự hay gặp trong SĐT thì gộp thành một dãy số, "+84"/"84" đầu số đổi về 0.
 */
export function khoaTimKiem(raw: string): string[] {
  const t = raw.normalize('NFC').trim();
  if (!t) return [];
  if (/\d/.test(t) && /^[\d\s.+\-()]+$/.test(t)) {
    const so = t.replace(/[^\d+]/g, '');
    if (so.startsWith('+84')) return [`0${so.slice(3)}`];
    const chuSo = so.replace(/\+/g, '');
    return [chuSo.startsWith('84') && chuSo.length === 11 ? `0${chuSo.slice(2)}` : chuSo];
  }
  // Bỏ ký tự đại diện của LIKE để khách gõ "%" không thành "khớp mọi thứ".
  const tu = boDau(t).toLowerCase().replace(/[%_\\]/g, ' ').split(/\s+/).filter(Boolean);
  return [...new Set(tu)].slice(0, 6);
}

/**
 * Chữ gõ tìm trong nội dung tin -> câu truy vấn to_tsquery('simple', ...) trên btt_bo_dau(text).
 * Mọi từ đều phải có; từ cuối khớp tiền tố để gõ dở "phu quo" vẫn ra "Phú Quốc". Trả null nếu không còn từ nào.
 */
export function truyVanTin(raw: string): string | null {
  const tu = boDau(raw.normalize('NFC'))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, 8);
  if (!tu.length) return null;
  return tu.map((t, i) => (i === tu.length - 1 ? `${t}:*` : t)).join(' & ');
}
