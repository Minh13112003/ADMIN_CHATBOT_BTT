import { createHmac, timingSafeEqual } from 'crypto';

/** Giới hạn khi tải lên (byte, trước khi thu nhỏ). Ảnh chat thường 1–5 MB nên 10 MB là thừa. */
export const GIOI_HAN_ANH = 10 * 1024 * 1024;
export const GIOI_HAN_PDF = 20 * 1024 * 1024;
export const GIOI_HAN_TEP_TOI_DA = Math.max(GIOI_HAN_ANH, GIOI_HAN_PDF);

export type LoaiTep = { type: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'; ext: 'jpg' | 'png' | 'webp' | 'pdf'; anh: boolean };

const PNG_DAU = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Nhận ra loại file theo nội dung (byte đầu), KHÔNG tin tên file hay Content-Type do người gửi khai:
 * đổi đuôi .exe thành .jpg là qua mặt được kiểm tra theo tên. Không nhận SVG và HTML vì chạy được script.
 */
export function nhanRaLoaiTep(b: Buffer): LoaiTep | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg', ext: 'jpg', anh: true };
  if (b.length >= 8 && b.subarray(0, 8).equals(PNG_DAU)) return { type: 'image/png', ext: 'png', anh: true };
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return { type: 'image/webp', ext: 'webp', anh: true };
  if (b.length >= 5 && b.toString('latin1', 0, 5) === '%PDF-') return { type: 'application/pdf', ext: 'pdf', anh: false };
  return null;
}

/** Lỗi bằng tiếng Việt để hiện cho người dùng, null nếu hợp lệ. */
export function loiTep(b: Buffer): string | null {
  const loai = nhanRaLoaiTep(b);
  if (!loai) return 'Chỉ gửi được ảnh (JPG, PNG, WebP) hoặc file PDF';
  if (loai.anh && b.length > GIOI_HAN_ANH) return 'Ảnh quá lớn, tối đa 10 MB';
  if (!loai.anh && b.length > GIOI_HAN_PDF) return 'File PDF quá lớn, tối đa 20 MB';
  return null;
}

/** Tên file hiện cho người xem: bỏ đường dẫn, ký tự điều khiển, giới hạn độ dài. Không bao giờ dùng tên này làm đường dẫn lưu. */
export function tenTepAnToan(ten: string | undefined | null, ext: string): string {
  const goc = (ten ?? '').trim();
  // Trình duyệt gửi tên UTF-8 nhưng multer đọc thành latin1: đổi lại để giữ dấu tiếng Việt.
  let s = /[À-ÿ]/.test(goc) && !/[^\u0000-ÿ]/.test(goc) ? Buffer.from(goc, 'latin1').toString('utf8') : goc;
  s = s.replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  if (!s || s === '.' || s === '..') return `tep.${ext}`;
  return s.length > 120 ? `${s.slice(0, 115 - ext.length)}….${ext}` : s;
}

/** Đường dẫn trong bucket: tháng + UUID + đuôi do mình quyết định (không bao giờ dùng tên file người gửi). Chia theo tháng cho dễ dọn về sau. */
export const duongDanLuuTru = (tepId: string, ext: string, luc: Date) => `${luc.getUTCFullYear()}-${String(luc.getUTCMonth() + 1).padStart(2, '0')}/${tepId}.${ext}`;

/**
 * Đường dẫn tuyệt đối của file trong thư mục lưu trữ trên ổ đĩa, hoặc null nếu `duongDan` không đúng dạng
 * `2026-11/<uuid>.jpg` (có `..`, bắt đầu bằng `/`, ký tự lạ). Đường dẫn do backend tự sinh nhưng vẫn kiểm tra
 * vì nó đi từ database ra ổ đĩa.
 */
export function duongDanTrongThuMuc(thuMuc: string, duongDan: string): string | null {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*\/[A-Za-z0-9][A-Za-z0-9_-]*\.[a-z0-9]{2,5}$/.test(duongDan)) return null;
  return `${thuMuc.replace(/[\\/]+$/, '')}/${duongDan}`;
}

/** Dòng tóm tắt ở danh sách hội thoại khi tin có file. */
export const tomTatDinhKem = (text: string, loai: string, ten: string) => {
  const t = text.trim();
  if (t) return t;
  return loai === 'application/pdf' ? `[Tệp] ${ten}` : '[Ảnh]';
};

const chuKy = (secret: string, id: string, exp: number) => createHmac('sha256', secret).update(`file:${id}:${exp}`).digest('hex').slice(0, 32);

/** Link xem file có hạn: /files/<id>?exp=<giây>&sig=<chữ ký>. Link chỉ mở được đúng file của tin đó và tự hết hạn. */
export function kyLinkTep(secret: string, messageId: string, hetHanLuc: number): string {
  return `/files/${messageId}?exp=${hetHanLuc}&sig=${chuKy(secret, messageId, hetHanLuc)}`;
}

export function kiemLinkTep(secret: string, messageId: string, exp: unknown, sig: unknown, nowSec: number): boolean {
  const e = Number(exp);
  if (!Number.isInteger(e) || e < nowSec || typeof sig !== 'string') return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(chuKy(secret, messageId, e));
  return a.length === b.length && timingSafeEqual(a, b);
}
