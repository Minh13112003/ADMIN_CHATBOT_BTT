import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Tài khoản app Mobile của khách (chủ dự án chốt 2026-11-16): chỉ sale tạo, tên đăng nhập là SĐT,
 * mật khẩu ngẫu nhiên 6 ký tự gồm chữ hoa, chữ thường và số.
 */

// Bỏ ký tự dễ nhầm khi đọc cho khách qua điện thoại hoặc gõ lại: 0/O/o, 1/l/I.
const HOA = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const THUONG = 'abcdefghijkmnpqrstuvwxyz';
const SO = '23456789';

/**
 * Mật khẩu 6 ký tự, luôn có ít nhất 1 chữ hoa, 1 chữ thường, 1 số. `ngauNhien(n)` trả số nguyên [0, n),
 * truyền `crypto.randomInt` khi chạy thật (test truyền hàm cố định).
 */
export function taoMatKhau(ngauNhien: (n: number) => number): string {
  const tat = HOA + THUONG + SO;
  const ky = [HOA, THUONG, SO, tat, tat, tat].map((bo) => bo[ngauNhien(bo.length)]);
  // Xáo trộn (Fisher–Yates) để chữ hoa không luôn đứng đầu.
  for (let i = ky.length - 1; i > 0; i--) {
    const j = ngauNhien(i + 1);
    [ky[i], ky[j]] = [ky[j], ky[i]];
  }
  return ky.join('');
}

/** App cũ hiển thị họ và tên tách đôi: tên là từ cuối, họ là phần còn lại. */
export function tachHoTen(ten: string): { firstName: string; lastName: string } {
  const tu = ten.trim().split(/\s+/).filter(Boolean);
  if (tu.length <= 1) return { firstName: tu[0] ?? '', lastName: '' };
  return { firstName: tu[tu.length - 1], lastName: tu.slice(0, -1).join(' ') };
}

/** Ghép lại tên đầy đủ kiểu Việt Nam khi app gửi họ, tên riêng. */
export function ghepHoTen(lastName: string | undefined, firstName: string | undefined): string {
  return [lastName, firstName].map((x) => (x ?? '').trim()).filter(Boolean).join(' ');
}

export type LyDoKhongTao = 'NEED_PHONE' | 'NEED_CLOSED_DEAL';

/** Sale chỉ tạo được tài khoản khi khách đã có SĐT và có đơn đã chốt (đang tính doanh thu). */
export function lyDoKhongTaoTaiKhoan(k: { phone: string | null; soDonDaChot: number }): LyDoKhongTao | null {
  if (!k.phone) return 'NEED_PHONE';
  if (k.soDonDaChot < 1) return 'NEED_CLOSED_DEAL';
  return null;
}

const chuKyAnh = (secret: string, accountId: string, exp: number) => createHmac('sha256', secret).update(`avatar:${accountId}:${exp}`).digest('hex').slice(0, 32);

/** Link ảnh đại diện app có hạn: /app/avatar/<id>?exp=&sig=&v=. `v` đổi khi khách đổi ảnh để app không giữ ảnh cũ trong bộ nhớ đệm. */
export function kyLinkAnh(secret: string, accountId: string, phienBan: string, hetHanLuc: number): string {
  return `/app/avatar/${accountId}?exp=${hetHanLuc}&sig=${chuKyAnh(secret, accountId, hetHanLuc)}&v=${encodeURIComponent(phienBan)}`;
}

export function kiemLinkAnh(secret: string, accountId: string, exp: unknown, sig: unknown, nowSec: number): boolean {
  const e = Number(exp);
  if (!Number.isInteger(e) || e < nowSec || typeof sig !== 'string') return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(chuKyAnh(secret, accountId, e));
  return a.length === b.length && timingSafeEqual(a, b);
}
