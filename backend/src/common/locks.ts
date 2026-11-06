// Ai nhắn với khách. Hàm thuần, có test ở locks.spec.ts.
// Từ 2026-11-06 không còn khoá khung nhắn: sale nào cũng nhắn được, chỉ cảnh báo khi đồng nghiệp đang soạn hoặc vừa gửi.

export type LockInput = {
  mode: 'BOT' | 'STAFF';
  assigneeId: string | null;
  lastStaffActivityAt: Date | null;
  lastStaffActivityBy: string | null;
};

/** OWNER: mình phụ trách. SUPPORT: người khác phụ trách, mình nhắn thì là hỗ trợ. UNASSIGNED: chưa ai, ai trả lời trước thì nhận. */
export type VaiTro = 'OWNER' | 'SUPPORT' | 'UNASSIGNED';

export function vaiTro(c: Pick<LockInput, 'assigneeId'>, userId: string): VaiTro {
  if (!c.assigneeId) return 'UNASSIGNED';
  return c.assigneeId === userId ? 'OWNER' : 'SUPPORT';
}

/** Id đồng nghiệp đang soạn hoặc vừa gửi trong `canhBaoMs`, null nếu không có ai khác. */
export function dongNghiepDangNhan(c: LockInput, userId: string, now: Date, canhBaoMs: number): string | null {
  if (!c.lastStaffActivityAt || !c.lastStaffActivityBy || c.lastStaffActivityBy === userId) return null;
  return now.getTime() - c.lastStaffActivityAt.getTime() < canhBaoMs ? c.lastStaffActivityBy : null;
}

/**
 * Gửi tin thì người phụ trách đổi thế nào ("trả lời là nhận"):
 * - Chưa ai phụ trách: người gửi nhận khách.
 * - Đã chia cho người khác nhưng người đó chưa trả lời (bot vẫn đang chạy): người trả lời trước nhận khách, khách không phải chờ.
 * - Người phụ trách đã trả lời rồi: người gửi chỉ là hỗ trợ, không đổi người phụ trách.
 */
export function nguoiPhuTrachSauKhiGui(c: Pick<LockInput, 'mode' | 'assigneeId'>, userId: string): { assigneeId: string; nhanKhach: boolean; hoTro: boolean } {
  if (!c.assigneeId) return { assigneeId: userId, nhanKhach: true, hoTro: false };
  if (c.assigneeId === userId) return { assigneeId: userId, nhanKhach: c.mode === 'BOT', hoTro: false };
  if (c.mode === 'BOT') return { assigneeId: userId, nhanKhach: true, hoTro: false };
  return { assigneeId: c.assigneeId, nhanKhach: false, hoTro: true };
}
