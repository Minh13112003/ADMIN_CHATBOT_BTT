// Hàm thuần cho voucher. Quy tắc chủ dự án chốt ngày 11/11/2026 (docs/stitch/GHIM-TOUR-VA-CHOT-TOUR.md). Có test ở vouchers.spec.ts.
import { boDau } from './text';

export type VoucherRule = {
  type: 'AMOUNT' | 'PERCENT';
  value: number;
  maxDiscount: number | null;
  scope: 'TOUR' | 'CATEGORY' | 'ALL';
  tourKey: string | null;
  categoryId: number | null;
  startsAt: Date;
  endsAt: Date;
  maxUses: number | null;
  isActive: boolean;
};

export type VoucherStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'PAUSED' | 'USED_UP';

/** Mã voucher: viết hoa, bỏ dấu và khoảng trắng; 3-30 ký tự chữ, số, - hoặc _. */
export function chuanHoaMaVoucher(raw: string | null | undefined): string | null {
  const t = boDau(raw ?? '').toUpperCase().replace(/\s+/g, '');
  return /^[A-Z0-9_-]{3,30}$/.test(t) ? t : null;
}

export function trangThaiVoucher(v: Pick<VoucherRule, 'isActive' | 'startsAt' | 'endsAt' | 'maxUses'>, now: Date, used: number): VoucherStatus {
  if (!v.isActive) return 'PAUSED';
  if (now > v.endsAt) return 'EXPIRED';
  if (v.maxUses !== null && used >= v.maxUses) return 'USED_UP';
  if (now < v.startsAt) return 'SCHEDULED';
  return 'ACTIVE';
}

const tien = (n: number) => `${n.toLocaleString('vi-VN')} đ`;

/** "1.000.000 đ" hoặc "20% (tối đa 3.000.000 đ)". */
export function moTaMucGiam(v: Pick<VoucherRule, 'type' | 'value' | 'maxDiscount'>): string {
  if (v.type === 'AMOUNT') return tien(v.value);
  return v.maxDiscount ? `${v.value}% (tối đa ${tien(v.maxDiscount)})` : `${v.value}%`;
}

/**
 * Số tiền voucher giảm cho một đơn. Giảm một lần trên tổng đơn (giá × số khách), không nhân theo khách,
 * không bao giờ quá tổng đơn. Phần trăm làm tròn xuống tới đồng rồi áp mức trần.
 */
export function tinhGiam(
  v: VoucherRule,
  ctx: { subtotal: number; tourKey: string | null; categoryIds: number[]; now: Date; used: number },
): { ok: true; discount: number } | { ok: false; error: string } {
  const st = trangThaiVoucher(v, ctx.now, ctx.used);
  if (st === 'PAUSED') return { ok: false, error: 'Voucher này đang tạm khoá' };
  if (st === 'EXPIRED') return { ok: false, error: 'Voucher này đã hết hạn' };
  if (st === 'SCHEDULED') return { ok: false, error: 'Voucher này chưa đến ngày áp dụng' };
  if (st === 'USED_UP') return { ok: false, error: 'Voucher này đã dùng hết lượt' };
  if (v.scope === 'TOUR' && (!ctx.tourKey || v.tourKey !== ctx.tourKey)) return { ok: false, error: 'Voucher này không áp dụng cho tour đã chọn' };
  if (v.scope === 'CATEGORY' && (v.categoryId === null || !ctx.categoryIds.includes(v.categoryId))) {
    return { ok: false, error: 'Voucher này không áp dụng cho tour đã chọn' };
  }
  let giam = v.type === 'AMOUNT' ? v.value : Math.floor((ctx.subtotal * v.value) / 100);
  if (v.type === 'PERCENT' && v.maxDiscount !== null) giam = Math.min(giam, v.maxDiscount);
  return { ok: true, discount: Math.max(0, Math.min(giam, ctx.subtotal)) };
}

/** Kiểm tra dữ liệu khi tạo hoặc sửa voucher. Trả lỗi tiếng Việt hoặc null. */
export function kiemTraVoucher(v: Pick<VoucherRule, 'type' | 'value' | 'maxDiscount' | 'scope' | 'tourKey' | 'categoryId' | 'startsAt' | 'endsAt' | 'maxUses'>): string | null {
  if (!Number.isInteger(v.value) || v.value <= 0) return 'Giá trị giảm phải lớn hơn 0';
  if (v.type === 'PERCENT' && v.value > 100) return 'Phần trăm giảm tối đa là 100';
  if (v.type === 'PERCENT' && v.maxDiscount !== null && v.maxDiscount <= 0) return 'Mức giảm tối đa phải lớn hơn 0';
  if (v.scope === 'TOUR' && !v.tourKey) return 'Chọn tour áp dụng';
  if (v.scope === 'CATEGORY' && v.categoryId === null) return 'Chọn địa điểm áp dụng';
  if (v.endsAt < v.startsAt) return 'Ngày kết thúc phải sau ngày bắt đầu';
  if (v.maxUses !== null && (!Number.isInteger(v.maxUses) || v.maxUses < 1)) return 'Số lần dùng tối đa phải từ 1';
  return null;
}
