import { chuanHoaMaTour, laCapNhatBookingCu, trangThaiTheoBooking } from './deals';

describe('chuanHoaMaTour', () => {
  it.each([
    ['A06.FIT.TW.070227.A', 'A06.FIT.TW.070227.A'],
    [' a06.fit.tw.070227.a ', 'A06.FIT.TW.070227.A'],
    ['A06. FIT .TW.070227.A', 'A06.FIT.TW.070227.A'],
    ['BTTOHK00HCMP20260718', 'BTTOHK00HCMP20260718'],
    ['TD1-NFHG_26', 'TD1-NFHG_26'],
  ])('%s -> %s', (raw, out) => expect(chuanHoaMaTour(raw)).toBe(out));

  it.each(['', 'A06', 'A06..FIT', '.A06.FIT', 'A06.FIT.', 'Tour Phú Quốc', 'tour phu quoc', 'TOURPHUQUOC', 'A06 FIT TW', 'A06/FIT/TW', 'X'.repeat(41), null, undefined])('từ chối %j', (raw) =>
    expect(chuanHoaMaTour(raw)).toBeNull(),
  );
});

describe('trangThaiTheoBooking', () => {
  it.each([
    ['PENDING', 'PAID', 'CONFIRMED'],
    ['PENDING', 'ONGOING', 'CONFIRMED'],
    ['PENDING', 'COMPLETED', 'CONFIRMED'],
    ['CONFIRMED', 'PAID', null],
    ['PENDING', 'CANCELLED', 'CANCELLED'],
    ['CONFIRMED', 'REFUNDED', 'CANCELLED'],
    ['CANCELLED', 'CANCELLED', null],
    ['PENDING', 'PENDING', null],
    ['PENDING', 'CONFIRMED', null],
    ['CONFIRMED', 'CONFIRMED', null],
  ] as const)('đơn %s, booking %s -> %s', (hienTai, booking, out) => expect(trangThaiTheoBooking(hienTai, booking)).toBe(out));

  it('booking đã huỷ rồi thanh toán lại thì đơn tính lại', () => expect(trangThaiTheoBooking('CANCELLED', 'PAID')).toBe('CONFIRMED'));
});

describe('laCapNhatBookingCu', () => {
  it('bỏ lần gửi cũ hoặc lặp lại, nhận lần mới hơn', () => {
    const last = new Date('2026-11-06T08:00:00.000Z');
    expect(laCapNhatBookingCu(last, new Date('2026-11-06T07:59:59.000Z'))).toBe(true);
    expect(laCapNhatBookingCu(last, last)).toBe(true);
    expect(laCapNhatBookingCu(last, new Date('2026-11-06T08:00:01.000Z'))).toBe(false);
    expect(laCapNhatBookingCu(last, null)).toBe(false);
  });
});
