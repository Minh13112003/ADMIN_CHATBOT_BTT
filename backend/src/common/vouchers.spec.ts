import { chuanHoaMaVoucher, kiemTraVoucher, moTaMucGiam, tinhGiam, trangThaiVoucher, type VoucherRule } from './vouchers';

const now = new Date('2026-11-20T03:00:00Z');
const base: VoucherRule = {
  type: 'AMOUNT', value: 1_000_000, maxDiscount: null, scope: 'ALL', tourKey: null, categoryId: null,
  startsAt: new Date('2026-11-01T00:00:00Z'), endsAt: new Date('2027-02-15T00:00:00Z'), maxUses: null, isActive: true,
};
const ctx = { subtotal: 39_980_000, tourKey: 'T1', categoryIds: [2, 55], now, used: 0 };

describe('tinhGiam', () => {
  it('giảm theo số tiền, một lần trên tổng đơn', () => expect(tinhGiam(base, ctx)).toEqual({ ok: true, discount: 1_000_000 }));
  it('phần trăm có mức trần', () => {
    expect(tinhGiam({ ...base, type: 'PERCENT', value: 20, maxDiscount: 3_000_000 }, ctx)).toEqual({ ok: true, discount: 3_000_000 });
    expect(tinhGiam({ ...base, type: 'PERCENT', value: 5, maxDiscount: 3_000_000 }, ctx)).toEqual({ ok: true, discount: 1_999_000 });
  });
  it('không giảm quá tổng đơn', () => expect(tinhGiam({ ...base, value: 50_000_000 }, ctx)).toEqual({ ok: true, discount: 39_980_000 }));
  it('sai tour hoặc địa điểm', () => {
    expect(tinhGiam({ ...base, scope: 'TOUR', tourKey: 'T2' }, ctx)).toMatchObject({ ok: false, error: 'Voucher này không áp dụng cho tour đã chọn' });
    expect(tinhGiam({ ...base, scope: 'CATEGORY', categoryId: 55 }, ctx)).toMatchObject({ ok: true });
    expect(tinhGiam({ ...base, scope: 'CATEGORY', categoryId: 9 }, ctx)).toMatchObject({ ok: false });
  });
  it('hết hạn, chưa tới ngày, tạm khoá, hết lượt', () => {
    expect(tinhGiam({ ...base, endsAt: new Date('2026-11-19T00:00:00Z') }, ctx)).toMatchObject({ error: 'Voucher này đã hết hạn' });
    expect(tinhGiam({ ...base, startsAt: new Date('2026-12-01T00:00:00Z') }, ctx)).toMatchObject({ error: 'Voucher này chưa đến ngày áp dụng' });
    expect(tinhGiam({ ...base, isActive: false }, ctx)).toMatchObject({ error: 'Voucher này đang tạm khoá' });
    expect(tinhGiam({ ...base, maxUses: 3 }, { ...ctx, used: 3 })).toMatchObject({ error: 'Voucher này đã dùng hết lượt' });
  });
});

describe('voucher khác', () => {
  it('chuẩn hoá mã', () => {
    expect(chuanHoaMaVoucher(' tết 2027 btt ')).toBe('TET2027BTT');
    expect(chuanHoaMaVoucher('ab')).toBeNull();
    expect(chuanHoaMaVoucher('A%B')).toBeNull();
  });
  it('mô tả mức giảm', () => {
    expect(moTaMucGiam(base)).toBe('1.000.000 đ');
    expect(moTaMucGiam({ type: 'PERCENT', value: 20, maxDiscount: 3_000_000 })).toBe('20% (tối đa 3.000.000 đ)');
  });
  it('trạng thái', () => {
    expect(trangThaiVoucher(base, now, 0)).toBe('ACTIVE');
    expect(trangThaiVoucher({ ...base, isActive: false, endsAt: new Date(0) }, now, 0)).toBe('PAUSED');
  });
  it('kiểm tra khi tạo', () => {
    expect(kiemTraVoucher(base)).toBeNull();
    expect(kiemTraVoucher({ ...base, type: 'PERCENT', value: 120 })).toBe('Phần trăm giảm tối đa là 100');
    expect(kiemTraVoucher({ ...base, scope: 'TOUR' })).toBe('Chọn tour áp dụng');
    expect(kiemTraVoucher({ ...base, endsAt: new Date('2026-01-01') })).toBe('Ngày kết thúc phải sau ngày bắt đầu');
  });
});
