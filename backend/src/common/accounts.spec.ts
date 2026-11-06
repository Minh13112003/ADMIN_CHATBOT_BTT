import { Role } from '../generated/prisma/client';
import { canChangeActive, canResetPassword } from './accounts';

describe('quy tắc tài khoản', () => {
  it('không tự khoá hoặc khoá admin cuối cùng', () => {
    expect(canChangeActive('a', { id: 'a', role: Role.ADMIN }, false, 2)).toBeTruthy();
    expect(canChangeActive('a', { id: 'b', role: Role.ADMIN }, false, 1)).toBeTruthy();
    expect(canChangeActive('a', { id: 'b', role: Role.ADMIN }, false, 2)).toBeNull();
  });
  it('không đặt mật khẩu cho admin khác', () => {
    expect(canResetPassword('a', { id: 'b', role: Role.ADMIN })).toBeTruthy();
    expect(canResetPassword('a', { id: 'b', role: Role.SALE })).toBeNull();
  });
});
