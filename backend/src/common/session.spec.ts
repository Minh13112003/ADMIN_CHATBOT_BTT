import { cauHinhPhien, hanToken, nenGiaHan } from './session';

const ch = cauHinhPhien();
const NGAY = 86_400;

describe('phiên đăng nhập', () => {
  it('mặc định 7 ngày không dùng, tối đa 30 ngày', () => {
    expect(ch).toEqual({ ngay: 7, toiDaNgay: 30 });
    expect(cauHinhPhien('2', '1')).toEqual({ ngay: 2, toiDaNgay: 2 });
    expect(cauHinhPhien('abc', '')).toEqual({ ngay: 7, toiDaNgay: 30 });
  });

  it('chỉ gia hạn khi token đã cấp quá 1 giờ', () => {
    expect(nenGiaHan({ iat: 1000, auth: 1000 }, 1000 + 1800, ch)).toBe(false);
    expect(nenGiaHan({ iat: 1000, auth: 1000 }, 1000 + 3600, ch)).toBe(true);
  });

  it('không gia hạn khi đã quá mốc tối đa từ lúc đăng nhập', () => {
    expect(nenGiaHan({ iat: 29 * NGAY, auth: 0 }, 30 * NGAY, ch)).toBe(false);
  });

  it('token cũ không có auth thì lấy iat', () => {
    expect(nenGiaHan({ iat: 1000 }, 1000 + 7200, ch)).toBe(true);
    expect(nenGiaHan({}, 99999, ch)).toBe(false);
  });

  it('hạn token không vượt mốc tối đa', () => {
    expect(hanToken(0, 0, ch)).toBe(7 * NGAY);
    expect(hanToken(0, 28 * NGAY, ch)).toBe(2 * NGAY);
  });
});
