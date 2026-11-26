/**
 * Biểu cảm thả vào tin nhắn (2026-11-26): 6 loại như Zalo / Messenger. Lưu mã ngắn trong bảng message_reactions,
 * giao diện và chatbot tự đổi ra emoji.
 */
export const BIEU_CAM = ['like', 'heart', 'haha', 'wow', 'sad', 'angry'] as const;
export type BieuCam = (typeof BIEU_CAM)[number];

export const TEN_BIEU_CAM: Record<BieuCam, string> = { like: 'thích', heart: 'thả tim', haha: 'haha', wow: 'wow', sad: 'buồn', angry: 'phẫn nộ' };

/** Mã `react_icon` của Zalo OA (theo diễn đàn Zalo for Developers, chưa kiểm chứng khi chạy thật). */
export const MA_ZALO: Record<BieuCam, string> = { like: '/-strong', heart: '/-heart', haha: ':>', wow: ':o', sad: ':-((', angry: ':-h' };

/** Khách thả trên Zalo: đổi mã Zalo sang loại của mình. Loại khác (hôn, tặng hoa...) trả null để ghi dòng nhật ký như cũ. */
export function tuMaZalo(ma: string | null | undefined): BieuCam | null {
  if (!ma) return null;
  const tim = (Object.entries(MA_ZALO) as [BieuCam, string][]).find(([, v]) => v === ma);
  return tim ? tim[0] : null;
}

export const laBieuCam = (x: unknown): x is BieuCam => typeof x === 'string' && (BIEU_CAM as readonly string[]).includes(x);

/** Khoá người thả: mỗi nhân viên một biểu cảm mỗi tin; khách dùng chung khoá "customer". */
export const KHOA_KHACH = 'customer';

/**
 * Thả lại đúng biểu cảm đang có thì gỡ, khác thì đổi (như Messenger). `null` = gỡ.
 */
export function bieuCamSau(hienTai: BieuCam | null, chon: BieuCam | null): BieuCam | null {
  if (!chon) return null;
  return hienTai === chon ? null : chon;
}

/** Ai được sửa tin: chỉ người gửi, chỉ tin nhân viên còn hiện, chỉ khi có chữ, kênh khách thấy được bản sửa. */
export function loiSuaTin(m: { senderType: string; staffId: string | null; internal: boolean; isAvailable: boolean; text: string }, userId: string, kenh: string): string | null {
  if (!m.isAvailable) return 'Tin này đã bị xoá';
  if (m.senderType !== 'STAFF' || m.internal) return 'Chỉ sửa được tin nhân viên gửi cho khách';
  if (m.staffId !== userId) return 'Bạn chỉ sửa được tin do chính mình gửi';
  if (!m.text.trim()) return 'Tin này không có chữ để sửa';
  if (kenh === 'ZALO' || kenh === 'FACEBOOK') return `${kenh === 'ZALO' ? 'Zalo' : 'Facebook'} không cho sửa tin đã gửi, khách sẽ vẫn thấy tin cũ. Bạn có thể xoá rồi gửi tin mới.`;
  return null;
}

/** Xoá tin ở kênh khách không bị thu hồi được: báo trước để nhân viên biết khách vẫn thấy tin. */
export function canhBaoXoa(kenh: string, senderType: string, internal: boolean): string | null {
  if (internal || senderType === 'CUSTOMER') return null;
  if (kenh === 'ZALO') return 'Zalo không có API thu hồi tin của OA, khách Zalo vẫn thấy tin này. Tin chỉ ẩn trong trang quản trị.';
  if (kenh === 'FACEBOOK') return 'Facebook không cho Trang thu hồi tin đã gửi, khách vẫn thấy tin này. Tin chỉ ẩn trong trang quản trị.';
  return null;
}
