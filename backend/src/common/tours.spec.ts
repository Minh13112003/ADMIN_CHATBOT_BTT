import { chonDiaDiem, diaDiemTuTen, khoaTour, khopTour, laMaDot, ngayVietNam, tienToMaDot } from './tours';

describe('chonDiaDiem', () => {
  const soTour = new Map([[2, 60], [10, 30], [55, 4]]);
  const ten = new Map([[2, 'Nước Ngoài'], [10, 'Châu Á'], [55, 'Đài Loan']]);
  it('lấy thể loại ít tour nhất', () => expect(chonDiaDiem([2, 10, 55], soTour, ten)).toEqual({ id: 55, name: 'Đài Loan' }));
  it('không có thể loại thì null', () => expect(chonDiaDiem([], soTour, ten)).toBeNull());
  it('bằng nhau lấy số lớn hơn', () => expect(chonDiaDiem([7, 9], new Map([[7, 3], [9, 3]]), new Map())).toEqual({ id: 9, name: '' }));
});

describe('mã đợt', () => {
  it('nhận ra mã đợt', () => {
    expect(laMaDot('A06.FIT.CN.200127.A')).toBe(true);
    expect(laMaDot('a06.fit.tw.070227.a')).toBe(true);
    expect(laMaDot('Ô Trấn')).toBe(false);
    expect(laMaDot('A06.FIT')).toBe(false);
  });
  it('phần đầu trước đoạn ngày', () => {
    expect(tienToMaDot('A06.FIT.CN.200127.A')).toBe('A06.FIT.CN');
    expect(tienToMaDot('ABC')).toBeNull();
  });
});

describe('khopTour', () => {
  const t = { name: 'Du Lịch Trung Quốc: Ô Trấn - Hàng Châu', code: 'A06.FIT.CN.241126.A' };
  it('khớp tên không dấu: cụm liền nhau cao hơn từng từ', () => {
    expect(khopTour(t, 'o tran')).toBe(2);
    expect(khopTour(t, 'Ô Trấn - Hàng')).toBe(2);
    expect(khopTour(t, 'hang trung')).toBe(1);
    expect(khopTour(t, 'thai lan')).toBe(0);
  });
  it('không khớp giữa từ', () => {
    expect(khopTour({ name: 'Du Lịch Hà Nội - Tràng An', code: null }, 'o tran')).toBe(0);
    expect(khopTour({ name: 'Malaysia: Trang Phục Truyền Thống', code: null }, 'o tran')).toBe(0);
  });
  it('khớp mã', () => expect(khopTour(t, 'fit.cn')).toBe(3));
});

describe('khoá và địa điểm theo tên', () => {
  it('khoá bỏ dấu, gọn khoảng trắng', () => expect(khoaTour('  Du Lịch  Đài Loan ')).toBe('du lich dai loan'));
  it('đoán địa điểm từ tên', () => {
    expect(diaDiemTuTen('Du Lịch Trung Quốc (Tết Âm Lịch 2027): Thượng Hải - Ô Trấn')).toBe('Trung Quốc');
    expect(diaDiemTuTen('Du Lịch Miền Tây: Tiền Giang - Cần Thơ')).toBe('Miền Tây');
    expect(diaDiemTuTen('Du Lịch Hà Nội - Ninh Bình')).toBe('Hà Nội');
    expect(diaDiemTuTen('Tour Phú Quốc 3N2Đ')).toBeNull();
  });
});

describe('ngayVietNam', () => {
  it('đầu và cuối ngày theo UTC+7', () => {
    expect(ngayVietNam('2026-11-15')!.toISOString()).toBe('2026-11-14T17:00:00.000Z');
    expect(ngayVietNam('2026-11-15', true)!.toISOString()).toBe('2026-11-15T16:59:59.999Z');
    expect(ngayVietNam('15/11/2026')).toBeNull();
  });
});
