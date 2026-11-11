import { Role } from '../generated/prisma/client';
import { kiemTraTaoTaiKhoan, phamViPhong } from './scope';

describe('phamViPhong', () => {
  it('admin toàn quyền thấy tất cả', () => expect(phamViPhong({ role: Role.ADMIN })).toBeNull());
  it('admin phòng và sale chỉ thấy phòng mình', () => {
    expect(phamViPhong({ role: Role.DEPT_ADMIN, departmentId: 'fit' })).toEqual(['fit']);
    expect(phamViPhong({ role: Role.SALE, departmentId: 'fit' })).toEqual(['fit']);
  });
  it('chưa có phòng thì không thấy gì', () => expect(phamViPhong({ role: Role.DEPT_ADMIN })).toEqual([]));
  it('Digital chỉ thấy phòng được cấp, bỏ trùng', () =>
    expect(phamViPhong({ role: Role.DIGITAL, scopeIds: ['a', 'a', 'b'] })).toEqual(['a', 'b']));
  it('Digital chưa được cấp phòng thì không thấy gì', () => expect(phamViPhong({ role: Role.DIGITAL })).toEqual([]));
});

describe('kiemTraTaoTaiKhoan', () => {
  const admin = { role: Role.ADMIN };
  const dept = { role: Role.DEPT_ADMIN, departmentId: 'fit' };
  it('admin tạo sale phải chọn phòng', () => {
    expect(kiemTraTaoTaiKhoan(admin, Role.SALE, null)).toMatch(/phòng/);
    expect(kiemTraTaoTaiKhoan(admin, Role.SALE, 'fit')).toBeNull();
    expect(kiemTraTaoTaiKhoan(admin, Role.DIGITAL, null)).toBeNull();
  });
  it('admin phòng chỉ tạo sale trong phòng mình', () => {
    expect(kiemTraTaoTaiKhoan(dept, Role.SALE, 'fit')).toBeNull();
    expect(kiemTraTaoTaiKhoan(dept, Role.SALE, 'inbound')).toMatch(/phòng của bạn/);
    expect(kiemTraTaoTaiKhoan(dept, Role.ADMIN, null)).toMatch(/sale/);
    expect(kiemTraTaoTaiKhoan(dept, Role.DEPT_ADMIN, 'fit')).toMatch(/sale/);
  });
  it('sale không tạo được', () => expect(kiemTraTaoTaiKhoan({ role: Role.SALE }, Role.SALE, null)).toMatch(/quyền/));
});
