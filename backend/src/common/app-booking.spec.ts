import { bacThanhVien, dauThangVN, diemThuong, duocChuyenTay, giaTheoKhach, homNayVN, thongBaoDon, trangApp, trangThaiTuDong } from './app-booking';

describe('đơn đặt từ app', () => {
  it('giá: người lớn 100%, trẻ em 80%, em bé 40%', () => {
    expect(giaTheoKhach(10_000_000, { adults: 2, children: 1, infants: 1 })).toBe(20_000_000 + 8_000_000 + 4_000_000);
    expect(giaTheoKhach(9_999_999, { adults: 0, children: 1, infants: 0 })).toBe(7_999_999);
  });

  it('sale bấm: cọc sau khi xác nhận, thanh toán sau xác nhận hoặc cọc, hoàn tiền sau cọc/thanh toán/huỷ', () => {
    expect(duocChuyenTay('CONFIRMED', 'DEPOSITED')).toBe(true);
    expect(duocChuyenTay('PENDING', 'DEPOSITED')).toBe(false);
    expect(duocChuyenTay('DEPOSITED', 'PAID')).toBe(true);
    expect(duocChuyenTay('COMPLETED', 'PAID')).toBe(false);
    expect(duocChuyenTay('CANCELLED', 'REFUNDED')).toBe(true);
    expect(duocChuyenTay('CONFIRMED', 'REFUNDED')).toBe(false);
    expect(duocChuyenTay(null, 'PAID')).toBe(false);
  });

  it('tự đổi theo ngày: tới ngày đi là Đang đi tour, qua ngày về là Hoàn thành', () => {
    const don = { status: 'DEPOSITED', departureDate: '2026-12-01', returnDate: '2026-12-05' };
    expect(trangThaiTuDong(don, '2026-11-30')).toBeNull();
    expect(trangThaiTuDong(don, '2026-12-01')).toBe('ONGOING');
    expect(trangThaiTuDong({ ...don, status: 'ONGOING' }, '2026-12-05')).toBeNull();
    expect(trangThaiTuDong({ ...don, status: 'ONGOING' }, '2026-12-06')).toBe('COMPLETED');
    // Đã xác nhận nhưng chưa cọc vẫn tự đổi; qua luôn ngày về thì thẳng Hoàn thành.
    expect(trangThaiTuDong({ ...don, status: 'CONFIRMED' }, '2026-12-10')).toBe('COMPLETED');
  });

  it('không tự đổi đơn chờ xác nhận, đã huỷ, hoặc không có ngày đi', () => {
    expect(trangThaiTuDong({ status: 'PENDING', departureDate: '2026-01-01', returnDate: null }, '2026-12-01')).toBeNull();
    expect(trangThaiTuDong({ status: 'CANCELLED', departureDate: '2026-01-01', returnDate: null }, '2026-12-01')).toBeNull();
    expect(trangThaiTuDong({ status: 'PAID', departureDate: null, returnDate: null }, '2026-12-01')).toBeNull();
  });

  it('điểm thưởng 1.000 đ = 1 điểm và 6 bậc', () => {
    expect(diemThuong(1_000_000)).toBe(1000);
    expect(diemThuong(999)).toBe(0);
    expect(bacThanhVien(0).ten).toBe('Đồng');
    expect(bacThanhVien(9_999)).toMatchObject({ ten: 'Đồng', bacSau: { ten: 'Bạc', tu: 10_000 } });
    expect(bacThanhVien(10_000).ten).toBe('Bạc');
    expect(bacThanhVien(500_000)).toMatchObject({ ten: 'Ruby', bacSau: null });
  });

  it('ngày theo giờ Việt Nam', () => {
    expect(homNayVN(new Date('2026-11-30T17:30:00Z'))).toBe('2026-12-01');
  });
});

describe('hạng, đầu tháng, thông báo, phân trang', () => {
  it('mã hạng', () => {
    expect(bacThanhVien(50_000).ma).toBe('VANG');
    expect(bacThanhVien(0).ma).toBe('DONG');
  });
  it('đầu tháng theo giờ Việt Nam', () => {
    // 17:30 UTC ngày 31/10 đã là 00:30 ngày 1/11 ở Việt Nam
    expect(dauThangVN(new Date('2026-10-31T17:30:00Z')).toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(dauThangVN(new Date('2026-11-16T03:00:00Z')).toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });
  it('thông báo đổi trạng thái', () => {
    expect(thongBaoDon('DEPOSITED', 'Tour Nhật')).toMatchObject({ title: 'Đã nhận tiền cọc' });
    expect(thongBaoDon('PENDING', 'Tour Nhật')).toBeNull();
  });
  it('phân trang dạng app cũ', () => {
    expect(trangApp([1, 2], 5, 1, 2).meta).toEqual({ total: 5, page: 1, limit: 2, totalPages: 3, hasNext: true, hasPrevious: false });
    expect(trangApp([], 0, 1, 20).meta.hasNext).toBe(false);
  });
});
