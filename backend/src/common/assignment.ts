// Thuật toán chia việc. Hàm thuần, có test ở assignment.spec.ts.

export type StaffLoad = { id: string; load: number; lastAssignedAt: Date | null };

/** Đọc lại trong transaction trước khi chia, tránh hai cron cùng chia một khách. */
export function canAssignAgain(c: { status: string; mode: string; assigneeId: string | null; contactAssignedAt: Date | null } | null, deadline: Date): boolean {
  if (!c) return false;
  if (c.status === 'PENDING') return c.assigneeId === null;
  if (c.status !== 'CONTACT') return false;
  return c.assigneeId === null || (c.mode === 'BOT' && !!c.contactAssignedAt && c.contactAssignedAt < deadline);
}

/** Người đang giữ ít khách nhất; bằng nhau thì người lâu chưa được chia nhất. */
export function chonNguoiItViecNhat(staff: StaffLoad[], boQua: string[] = []): string | null {
  const ungVien = staff.filter((s) => !boQua.includes(s.id));
  if (!ungVien.length) return null;
  return [...ungVien].sort((a, b) => {
    if (a.load !== b.load) return a.load - b.load;
    const ta = a.lastAssignedAt?.getTime() ?? 0;
    const tb = b.lastAssignedAt?.getTime() ?? 0;
    return ta - tb || a.id.localeCompare(b.id);
  })[0].id;
}

/** Khách cũ về người cũ nếu người đó đang trực, không thì chia như thường. */
export function chonNguoiXuLy(staff: StaffLoad[], nguoiCu: string | null, boQua: string[] = []): string | null {
  if (nguoiCu && !boQua.includes(nguoiCu) && staff.some((s) => s.id === nguoiCu)) return nguoiCu;
  return chonNguoiItViecNhat(staff, boQua);
}
