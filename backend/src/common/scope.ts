import { Prisma, Role } from '../generated/prisma/client';

export type ScopeUser = { role: Role; departmentId?: string | null; scopeIds?: string[] | null };

/** Phạm vi dữ liệu của một tài khoản: null = toàn công ty, mảng = chỉ các phòng này (có thể rỗng = không thấy gì). */
export function phamViPhong(u: ScopeUser): string[] | null {
  if (u.role === Role.ADMIN) return null;
  if (u.role === Role.DEPT_ADMIN || u.role === Role.SALE) return u.departmentId ? [u.departmentId] : [];
  if (u.role === Role.DIGITAL) return [...new Set(u.scopeIds ?? [])];
  return [];
}

/** Admin phòng chỉ được tạo sale trong phòng mình; admin toàn quyền tạo mọi vai trò. Trả về lỗi tiếng Việt hoặc null. */
export function kiemTraTaoTaiKhoan(actor: ScopeUser, role: Role, departmentId: string | null): string | null {
  if (actor.role === Role.ADMIN) {
    if ((role === Role.SALE || role === Role.DEPT_ADMIN) && !departmentId) return 'Chọn phòng ban cho tài khoản này';
    return null;
  }
  if (actor.role === Role.DEPT_ADMIN) {
    if (role !== Role.SALE) return 'Admin phòng chỉ tạo được tài khoản sale';
    if (!actor.departmentId || departmentId !== actor.departmentId) return 'Chỉ tạo được tài khoản trong phòng của bạn';
    return null;
  }
  return 'Bạn không có quyền tạo tài khoản';
}

/** Giá trị đặc biệt trong phạm vi của Digital: gồm cả khách chưa được chia cho sale nào (đa số khách chỉ chat với bot). */
export const CHUA_PHAN = 'CHUA_PHAN';

/** Điều kiện Prisma: hội thoại thuộc phòng (qua người phụ trách). null = không lọc. */
export function locHoiThoai(scope: string[] | null) {
  if (scope === null) return {};
  const phong = scope.filter((x) => x !== CHUA_PHAN);
  const or: object[] = [{ assignee: { departmentId: { in: phong } } }];
  if (scope.includes(CHUA_PHAN)) or.push({ assigneeId: null });
  return { OR: or };
}

/** Cùng điều kiện nhưng cho câu SQL thô; c là bảng conversations. */
export function sqlPhamHoiThoai(scope: string[] | null) {
  if (scope === null) return Prisma.sql`TRUE`;
  const phong = scope.filter((x) => x !== CHUA_PHAN);
  const chua = scope.includes(CHUA_PHAN);
  return Prisma.sql`(c."assigneeId" IN (SELECT id FROM users WHERE "departmentId" = ANY(${phong}::text[])) OR (${chua} AND c."assigneeId" IS NULL))`;
}

/** Phạm vi thực của một yêu cầu thống kê: giao giữa quyền của người dùng và phòng họ chọn lọc (chỉ thu hẹp, không mở rộng). */
export function phamViThongKe(user: ScopeUser, chon?: string | null): string[] | null {
  const quyen = phamViPhong(user);
  if (!chon) return quyen;
  if (quyen === null) return [chon];
  return quyen.includes(chon) ? [chon] : [];
}
