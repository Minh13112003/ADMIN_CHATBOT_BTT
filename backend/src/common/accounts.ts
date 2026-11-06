import { Role } from '../generated/prisma/client';

/** Quy tắc bảo vệ tài khoản quản trị. */
export function canChangeActive(actorId: string, target: { id: string; role: Role }, active: boolean, activeAdmins: number): string | null {
  if (!active && actorId === target.id) return 'Bạn không thể tự khoá tài khoản của mình';
  if (!active && target.role === Role.ADMIN && activeAdmins <= 1) return 'Không thể khoá admin cuối cùng';
  return null;
}

export function canResetPassword(actorId: string, target: { id: string; role: Role }): string | null {
  if (target.role === Role.ADMIN && actorId !== target.id) return 'Không thể đặt lại mật khẩu cho admin khác';
  return null;
}
