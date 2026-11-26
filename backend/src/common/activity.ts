import { tomTat } from './text';
import { laBieuCam, TEN_BIEU_CAM } from './reactions';

/**
 * Nhật ký thao tác (2026-11-26): đổi một yêu cầu ghi dữ liệu thành dòng nhật ký dễ đọc cho admin toàn quyền.
 * Chỉ đọc đúng các trường liệt kê ở đây, KHÔNG BAO GIỜ đọc mật khẩu, token, khoá bí mật trong body.
 */
export type NhomThaoTac = 'MESSAGE' | 'CONVERSATION' | 'DEAL' | 'ACCOUNT' | 'VOUCHER' | 'SETTINGS' | 'AUTH' | 'RESTORE';
export const NHOM_THAO_TAC: NhomThaoTac[] = ['MESSAGE', 'CONVERSATION', 'DEAL', 'ACCOUNT', 'VOUCHER', 'SETTINGS', 'AUTH', 'RESTORE'];

export type MucNhatKy = { group: NhomThaoTac; action: string; summary: string; conversationId?: string; targetId?: string };

export type YeuCau = {
  method: string;
  /** Mẫu đường dẫn không có tiền tố /api/v1, ví dụ `/conversations/:id/messages`. */
  path: string;
  params: Record<string, string | undefined>;
  body: Record<string, unknown> | undefined;
  /** Kết quả route trả về (đã thành công). */
  ketQua: unknown;
  /** Tên khách của hội thoại `:id` nếu có. */
  khach?: string | null;
  /** Tên đối tượng `:id` đọc trước khi chạy (mã voucher, tên tài khoản), vì có route xoá xong không trả lại tên. */
  doiTuong?: string | null;
};

const TRANG_THAI: Record<string, string> = { CONTACT: 'Liên hệ', UNREAD: 'Chưa xem', READ: 'Đã xem', PENDING: 'Chờ xử lý', CLOSED: 'Đã chốt' };
const VAI_TRO: Record<string, string> = { ADMIN: 'admin toàn quyền', SALE: 'sale', DEPT_ADMIN: 'admin phòng', DIGITAL: 'Digital' };
const KENH: Record<string, string> = { zalo: 'Zalo', facebook: 'Facebook', ZALO: 'Zalo', FACEBOOK: 'Facebook' };

/** Các route không cần ghi: đọc, đánh dấu đã xem, tính giá thử, đếm lượt dùng mẫu. */
const BO_QUA = new Set([
  'POST /conversations/:id/read',
  'POST /tours/quote',
  'POST /templates/:id/use',
  'POST /auto-replies/test',
  'POST /auth/logout',
]);

const chu = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? tomTat(v, max) : '');
const truong = (o: unknown, k: string): unknown => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined);

export function moTaThaoTac(y: YeuCau): MucNhatKy | null {
  const p = y.path.replace(/^\/api\/v1/, '').replace(/\/$/, '') || '/';
  const khoa = `${y.method.toUpperCase()} ${p}`;
  if (BO_QUA.has(khoa)) return null;
  // Route của khách (app mobile), webhook và chatbot không do nhân viên làm.
  if (p.startsWith('/app/') || p.startsWith('/ingest') || p.startsWith('/webhooks')) return null;
  const b = y.body ?? {};
  const kq = y.ketQua;
  const cid = y.params.id;
  const voi = y.khach ? ` với khách ${y.khach}` : '';
  const cho = y.khach ? ` cho khách ${y.khach}` : '';
  const conv = (group: NhomThaoTac, action: string, summary: string, targetId?: string): MucNhatKy => ({ group, action, summary, conversationId: cid, targetId });

  switch (khoa) {
    // Tin nhắn
    case 'POST /conversations/:id/messages':
      return conv('MESSAGE', 'message.send', `Nhắn${cho}: "${chu(b.text)}"`, String(truong(kq, 'id') ?? ''));
    case 'POST /conversations/:id/messages/file':
      return conv('MESSAGE', 'message.file', `Gửi tệp${cho}${chu(b.text) ? `: "${chu(b.text)}"` : ''}`, String(truong(kq, 'id') ?? ''));
    case 'POST /conversations/:id/messages/sticker':
      return conv('MESSAGE', 'message.sticker', `Gửi sticker${cho}`, String(truong(kq, 'id') ?? ''));
    case 'PATCH /conversations/:id/messages/:messageId':
      return conv('MESSAGE', 'message.edit', `Sửa tin${voi} thành: "${chu(b.text)}"`, y.params.messageId);
    case 'DELETE /conversations/:id/messages/:messageId':
      return conv('MESSAGE', 'message.delete', `Xoá tin${voi}${chu(truong(kq, 'text'), 80) ? `: "${chu(truong(kq, 'text'), 80)}"` : ''}`, y.params.messageId);
    case 'POST /conversations/:id/messages/:messageId/reaction': {
      const e = truong(kq, 'emoji');
      return conv('MESSAGE', 'message.react', laBieuCam(e) ? `Thả "${TEN_BIEU_CAM[e]}" vào tin${voi}` : `Gỡ biểu cảm khỏi tin${voi}`, y.params.messageId);
    }
    // Hội thoại
    case 'POST /conversations/:id/give-back':
      return conv('CONVERSATION', 'conversation.give_back', `Trả khách ${y.khach ?? ''} lại cho bot`.replace(/\s+/g, ' ').trim());
    case 'POST /conversations/:id/handover': {
      const den = truong(truong(kq, 'assignee'), 'fullName');
      return conv('CONVERSATION', 'conversation.handover', `Chuyển khách ${y.khach ?? ''} cho ${typeof den === 'string' ? den : 'đồng nghiệp'}${chu(b.note) ? ` (ghi chú: ${chu(b.note)})` : ''}`.replace(/\s+/g, ' '));
    }
    case 'POST /conversations/:id/status':
      return conv('CONVERSATION', 'conversation.status', `Đổi trạng thái hội thoại${voi} sang ${TRANG_THAI[String(b.status)] ?? String(b.status)}`);
    case 'POST /conversations/:id/customer-phone':
      return conv('CONVERSATION', 'conversation.phone', `Cập nhật số điện thoại khách ${y.khach ?? ''}: ${chu(b.phone, 30)}`.replace(/\s+/g, ' '));
    case 'PATCH /conversations/:id': {
      const viec = [
        b.followUpAt === null ? 'bỏ hẹn nhắc' : b.followUpAt ? 'đặt hẹn nhắc' : '',
        b.note !== undefined ? 'sửa ghi chú' : '',
        b.tags !== undefined ? 'sửa nhãn' : '',
        b.interest !== undefined ? 'sửa nhu cầu' : '',
        b.autoReplyOn !== undefined ? (b.autoReplyOn ? 'bật trả lời tự động' : 'tắt trả lời tự động') : '',
      ].filter(Boolean);
      return conv('CONVERSATION', 'conversation.patch', `${viec.length ? viec.join(', ').replace(/^./, (c) => c.toUpperCase()) : 'Cập nhật hội thoại'}${voi}`);
    }
    case 'DELETE /conversations/:id':
      return conv('CONVERSATION', 'conversation.delete', `Xoá hội thoại${voi} (chuyển vào Khôi phục)`);
    case 'POST /conversations/:id/zalo-request-phone':
      return conv('CONVERSATION', 'conversation.zalo_phone', `Gửi thẻ xin số điện thoại qua Zalo${cho}`);
    case 'POST /conversations/:id/zalo-history':
      return conv('CONVERSATION', 'conversation.zalo_history', `Đồng bộ tin cũ từ Zalo${voi}`);
    case 'POST /conversations/import-old':
      return { group: 'SETTINGS', action: 'zalo.import', summary: 'Lấy tin 30 ngày gần đây từ Zalo' };
    case 'POST /conversations/:id/tour-tags':
      return conv('CONVERSATION', 'tour_tag.add', `Ghim tour quan tâm${cho}${chu(truong(kq, 'tourName')) ? `: ${chu(truong(kq, 'tourName'))}` : ''}`);
    case 'DELETE /conversations/:id/tour-tags/:tagId':
      return conv('CONVERSATION', 'tour_tag.remove', `Gỡ nhãn tour quan tâm${voi}`, y.params.tagId);
    case 'POST /conversations/:id/app-account':
      return conv('ACCOUNT', 'app_account.issue', `Tạo / cấp lại tài khoản app${cho}`);
    // Đơn
    case 'POST /conversations/:id/close':
      return conv('DEAL', 'deal.close', `Chốt tour${cho}: mã đợt ${chu(b.dayCode, 60)}, ${Number(b.adults ?? b.guests) || 0} người lớn${Number(b.children) ? `, ${Number(b.children)} trẻ em` : ''}${Number(b.infants) ? `, ${Number(b.infants)} em bé` : ''}${chu(b.voucherCode, 40) ? `, voucher ${chu(b.voucherCode, 40)}` : ''}`);
    case 'POST /conversations/:id/deals/:dealId/cancel':
      return conv('DEAL', 'deal.cancel', `Huỷ đơn${voi}${chu(b.reason) ? `: ${chu(b.reason)}` : ''}`, y.params.dealId);
    case 'POST /conversations/:id/deals/:dealId/booking-status':
      return conv('DEAL', 'deal.booking_status', `Đổi trạng thái đơn app${voi} sang ${chu(b.status, 30)}`, y.params.dealId);
    // Tài khoản
    case 'POST /users':
      return { group: 'ACCOUNT', action: 'user.create', summary: `Tạo tài khoản ${chu(b.fullName, 80)} (${chu(b.email, 120)}, ${VAI_TRO[String(b.role ?? 'SALE')] ?? String(b.role)})`, targetId: String(truong(kq, 'id') ?? '') };
    case 'PATCH /users/:id/active':
      return { group: 'ACCOUNT', action: 'user.active', summary: `${b.isActive ? 'Mở khoá' : 'Khoá'} tài khoản ${chu(y.doiTuong, 80) || chu(truong(kq, 'fullName'), 80) || 'nhân viên'}`, targetId: cid };
    case 'POST /users/:id/reset-password':
      return { group: 'ACCOUNT', action: 'user.reset_password', summary: `Đặt lại mật khẩu cho ${chu(y.doiTuong, 80) || 'một tài khoản'}`, targetId: cid };
    case 'PATCH /users/me/duty':
      return { group: 'ACCOUNT', action: 'user.duty', summary: b.onDuty ? 'Bật "Đang trực"' : 'Tắt "Đang trực"' };
    case 'POST /departments':
      return { group: 'ACCOUNT', action: 'department.create', summary: `Tạo phòng ban ${chu(b.name, 80)}` };
    case 'PATCH /departments/:id':
      return { group: 'ACCOUNT', action: 'department.update', summary: `Sửa phòng ban ${chu(b.name, 80) || chu(truong(kq, 'name'), 80)}`.trim(), targetId: cid };
    case 'PATCH /auth/me':
      return { group: 'AUTH', action: 'profile.update', summary: 'Cập nhật hồ sơ cá nhân' };
    case 'POST /auth/me/avatar':
    case 'DELETE /auth/me/avatar':
      return { group: 'AUTH', action: 'profile.avatar', summary: y.method.toUpperCase() === 'DELETE' ? 'Xoá ảnh đại diện' : 'Đổi ảnh đại diện' };
    case 'POST /auth/change-password':
      return { group: 'AUTH', action: 'auth.change_password', summary: 'Đổi mật khẩu của mình' };
    case 'POST /auth/login':
      return { group: 'AUTH', action: 'auth.login', summary: 'Đăng nhập' };
    // Voucher
    case 'POST /vouchers':
      return { group: 'VOUCHER', action: 'voucher.create', summary: `Tạo voucher ${chu(b.code, 40) || chu(truong(kq, 'code'), 40)}`, targetId: String(truong(kq, 'id') ?? '') };
    case 'PATCH /vouchers/:id':
      return { group: 'VOUCHER', action: 'voucher.update', summary: `Sửa voucher ${chu(y.doiTuong, 40) || chu(truong(kq, 'code'), 40) || chu(b.code, 40)}`.trim(), targetId: cid };
    case 'PATCH /vouchers/:id/active':
      return { group: 'VOUCHER', action: 'voucher.active', summary: `${b.isActive ? 'Mở lại' : 'Tạm khoá'} voucher ${chu(y.doiTuong, 40) || chu(truong(kq, 'code'), 40)}`.trim(), targetId: cid };
    case 'DELETE /vouchers/:id':
      return { group: 'VOUCHER', action: 'voucher.delete', summary: `Xoá voucher ${chu(y.doiTuong, 40)}`.trim(), targetId: cid };
    // Cài đặt
    case 'POST /templates':
      return { group: 'SETTINGS', action: 'template.create', summary: `Tạo mẫu trả lời nhanh "${chu(b.title, 80)}"` };
    case 'PATCH /templates/:id':
      return { group: 'SETTINGS', action: 'template.update', summary: `Sửa mẫu trả lời nhanh "${chu(b.title, 80) || chu(truong(kq, 'title'), 80)}"`, targetId: cid };
    case 'DELETE /templates/:id':
      return { group: 'SETTINGS', action: 'template.delete', summary: 'Xoá một mẫu trả lời nhanh', targetId: cid };
    case 'POST /auto-replies':
      return { group: 'SETTINGS', action: 'rule.create', summary: `Tạo quy tắc trả lời tự động "${chu(b.name, 80)}"` };
    case 'PATCH /auto-replies/:id':
      return { group: 'SETTINGS', action: 'rule.update', summary: `Sửa quy tắc trả lời tự động${chu(b.name, 80) ? ` "${chu(b.name, 80)}"` : ''}${b.enabled === false ? ' (tắt)' : b.enabled === true ? ' (bật)' : ''}`, targetId: cid };
    case 'DELETE /auto-replies/:id':
      return { group: 'SETTINGS', action: 'rule.delete', summary: 'Xoá một quy tắc trả lời tự động', targetId: cid };
    case 'PUT /channel-settings/:channel':
      return { group: 'SETTINGS', action: 'channel.save', summary: `Lưu thông tin kết nối ${KENH[String(y.params.channel)] ?? y.params.channel}` };
    case 'DELETE /channel-settings/:channel':
      return { group: 'SETTINGS', action: 'channel.delete', summary: `Xoá kết nối ${KENH[String(y.params.channel)] ?? y.params.channel}` };
    case 'POST /channel-settings/facebook/test':
      return { group: 'SETTINGS', action: 'channel.test', summary: 'Kiểm tra kết nối Facebook' };
    case 'POST /tour-interest/rescan':
      return { group: 'SETTINGS', action: 'tour_interest.rescan', summary: 'Quét lại tin nhắn cũ cho Nhu cầu tour' };
    case 'POST /stickers/packs':
      return { group: 'SETTINGS', action: 'sticker.pack_create', summary: `Tạo bộ sticker ${chu(b.name, 80)}`.trim() };
    case 'PATCH /stickers/packs/:id':
      return { group: 'SETTINGS', action: 'sticker.pack_update', summary: 'Sửa bộ sticker', targetId: cid };
    case 'POST /stickers':
      return { group: 'SETTINGS', action: 'sticker.add', summary: 'Thêm sticker vào kho' };
    case 'PATCH /stickers/:id/pack':
    case 'PATCH /stickers/:id/zalo':
    case 'PATCH /stickers/:id/hide':
      return { group: 'SETTINGS', action: 'sticker.update', summary: p.endsWith('/hide') ? 'Ẩn / hiện một sticker' : p.endsWith('/zalo') ? 'Gắn mã sticker Zalo' : 'Chuyển sticker sang bộ khác', targetId: cid };
    // Khôi phục
    case 'POST /trash/conversations/:id/restore':
      return conv('RESTORE', 'trash.restore_conversation', `Khôi phục hội thoại${voi}`);
    case 'DELETE /trash/conversations/:id':
      return { group: 'RESTORE', action: 'trash.purge_conversation', summary: `Xoá hẳn hội thoại${chu(truong(kq, 'name'), 80) ? ` với khách ${chu(truong(kq, 'name'), 80)}` : ''} khỏi database`, targetId: cid };
    case 'POST /trash/messages/:id/restore':
      return { group: 'RESTORE', action: 'trash.restore_message', summary: `Khôi phục tin nhắn${chu(truong(kq, 'name'), 80) ? ` với khách ${chu(truong(kq, 'name'), 80)}` : ''}`, targetId: cid, conversationId: String(truong(kq, 'conversationId') ?? '') || undefined };
    case 'DELETE /trash/messages/:id':
      return { group: 'RESTORE', action: 'trash.purge_message', summary: `Xoá hẳn tin nhắn${chu(truong(kq, 'name'), 80) ? ` với khách ${chu(truong(kq, 'name'), 80)}` : ''} khỏi database`, targetId: cid };
  }
  // Route ghi khác chưa có mô tả riêng: vẫn ghi để không bỏ sót.
  return { group: 'SETTINGS', action: 'other', summary: `Thao tác khác: ${khoa}`, conversationId: p.startsWith('/conversations/:id') ? cid : undefined };
}

/** Đầu và cuối một ngày giờ Việt Nam (UTC+7), `ngay` dạng YYYY-MM-DD. Sai định dạng thì null. */
export function khoangNgayVN(ngay: string): { tu: Date; den: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) return null;
  const tu = new Date(`${ngay}T00:00:00+07:00`);
  if (Number.isNaN(tu.getTime())) return null;
  return { tu, den: new Date(tu.getTime() + 24 * 3600_000) };
}
