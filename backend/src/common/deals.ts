// Quy tắc đơn đặt tour. Hàm thuần, có test ở deals.spec.ts.

export type DealStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

/** Trạng thái booking của BE Mobile (enum BookingStatus bên D:\E-Commerce\Backend\e-commerce). */
export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'PAID', 'ONGOING', 'COMPLETED', 'CANCELLED', 'REFUNDED'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Outbox có thể giao lệch thứ tự; bỏ mọi sự kiện có mốc không mới hơn lần đã áp dụng. */
export function laCapNhatBookingCu(lastApplied: Date | null, occurredAt: Date | null): boolean {
  return !!lastApplied && !!occurredAt && lastApplied.getTime() >= occurredAt.getTime();
}

/**
 * Mã đợt khởi hành trên benthanhtourist.com, ví dụ "A06.FIT.TW.070227.A" hoặc "BTTOHK00HCMP20260718".
 * Viết hoa, bỏ khoảng trắng. Chỉ nhận chữ, số và dấu . - _ giữa các phần. Trả null nếu không hợp lệ.
 * Không tra được mã trên benthanhtourist.com vì API không có tìm theo mã, nên chỉ kiểm tra hình thức.
 */
export function chuanHoaMaTour(raw: string | null | undefined): string | null {
  // Khoảng trắng sát dấu chấm (dán từ chỗ khác: "A06. FIT") thì bỏ; khoảng trắng giữa chữ ("tour phu quoc") là gõ nhầm tên tour, từ chối.
  const t = (raw ?? '').normalize('NFC').trim().replace(/\s*([.\-_])\s*/g, '$1').toUpperCase();
  if (t.length < 4 || t.length > 40 || /\s/.test(t) || !/\d/.test(t)) return null;
  return /^[A-Z0-9]+(?:[.\-_][A-Z0-9]+)*$/.test(t) ? t : null;
}

/**
 * Booking đổi trạng thái thì đơn đổi thế nào. null = giữ nguyên.
 * - Đã thanh toán, đang đi, đã đi: đơn chắc chắn, tính doanh thu dù sale chưa bấm xác nhận.
 * - Huỷ, hoàn tiền: không tính nữa, kể cả đơn sale đã chốt.
 * - PENDING, CONFIRMED (giữ chỗ, chưa trả tiền): không đổi, việc chốt vẫn do sale gọi khách.
 */
export function trangThaiTheoBooking(hienTai: DealStatus, booking: BookingStatus): DealStatus | null {
  if (booking === 'PAID' || booking === 'ONGOING' || booking === 'COMPLETED') return hienTai === 'CONFIRMED' ? null : 'CONFIRMED';
  if (booking === 'CANCELLED' || booking === 'REFUNDED') return hienTai === 'CANCELLED' ? null : 'CANCELLED';
  return null;
}
