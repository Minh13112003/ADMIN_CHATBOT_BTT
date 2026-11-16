import { randomInt } from 'crypto';
import { ghepHoTen, lyDoKhongTaoTaiKhoan, tachHoTen, taoMatKhau } from './app-account';

describe('taoMatKhau', () => {
  it('6 ký tự, luôn có chữ hoa, chữ thường, số; không có ký tự dễ nhầm', () => {
    for (let i = 0; i < 500; i++) {
      const mk = taoMatKhau(randomInt);
      expect(mk).toHaveLength(6);
      expect(mk).toMatch(/[A-Z]/);
      expect(mk).toMatch(/[a-z]/);
      expect(mk).toMatch(/[0-9]/);
      expect(mk).not.toMatch(/[0O1lIo]/);
    }
  });
  it('dùng đúng hàm ngẫu nhiên được truyền vào', () => {
    expect(taoMatKhau(() => 0)).toBe(taoMatKhau(() => 0));
  });
});

describe('họ tên', () => {
  it('tách tên là từ cuối', () => {
    expect(tachHoTen('Nguyễn Thị Hoa')).toEqual({ firstName: 'Hoa', lastName: 'Nguyễn Thị' });
    expect(tachHoTen('  Hoa ')).toEqual({ firstName: 'Hoa', lastName: '' });
    expect(tachHoTen('')).toEqual({ firstName: '', lastName: '' });
  });
  it('ghép lại họ trước tên sau', () => {
    expect(ghepHoTen('Nguyễn Thị', 'Hoa')).toBe('Nguyễn Thị Hoa');
    expect(ghepHoTen('', 'Hoa')).toBe('Hoa');
  });
});

describe('lyDoKhongTaoTaiKhoan', () => {
  it('cần SĐT trước, rồi cần đơn đã chốt', () => {
    expect(lyDoKhongTaoTaiKhoan({ phone: null, soDonDaChot: 1 })).toBe('NEED_PHONE');
    expect(lyDoKhongTaoTaiKhoan({ phone: '0914438603', soDonDaChot: 0 })).toBe('NEED_CLOSED_DEAL');
    expect(lyDoKhongTaoTaiKhoan({ phone: '0914438603', soDonDaChot: 1 })).toBeNull();
  });
});
