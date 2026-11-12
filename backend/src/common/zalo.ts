import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Hàm thuần cho Zalo OA (có test). Cách ký webhook và PKCE theo mô tả của Zalo ở nguồn bên thứ ba,
 * CHƯA đối chiếu tài liệu chính thức: nếu Zalo từ chối khi chạy thật thì sửa ở đây.
 */

/** mac = sha256(appId + nội dung gốc + timestamp + OA Secret Key), dạng hex. */
export function chuKyZalo(appId: string, noiDungGoc: string, timestamp: string, oaSecretKey: string): string {
  return createHash('sha256').update(appId + noiDungGoc + timestamp + oaSecretKey).digest('hex');
}

/** `header` có thể là "mac=<hex>" hoặc chỉ "<hex>". So sánh thời gian cố định. */
export function chuKyHopLe(header: string | undefined, appId: string, noiDungGoc: string, timestamp: string, oaSecretKey: string): boolean {
  if (!header || !appId || !oaSecretKey) return false;
  const nhan = header.trim().replace(/^mac=/i, '').toLowerCase();
  const dung = chuKyZalo(appId, noiDungGoc, timestamp, oaSecretKey);
  if (nhan.length !== dung.length) return false;
  return timingSafeEqual(Buffer.from(nhan), Buffer.from(dung));
}

const base64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** PKCE: verifier ngẫu nhiên, challenge = base64url(sha256(verifier)). */
export function taoPkce() {
  const verifier = base64url(randomBytes(48));
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) };
}

export type SuKienZalo = { userId: string; msgId: string | null; text: string; laText: boolean; tenSuKien: string; timestamp: string };

const TEN_LOAI: Record<string, string> = {
  user_send_image: 'ảnh',
  user_send_file: 'tệp',
  user_send_audio: 'tin thoại',
  user_send_video: 'video',
  user_send_sticker: 'sticker',
  user_send_gif: 'ảnh động',
  user_send_location: 'vị trí',
  user_send_link: 'liên kết',
  user_send_business_card: 'danh thiếp',
};

/** Chỉ nhận tin KHÁCH gửi cho OA (user_send_*). Sự kiện khác (OA gửi, theo dõi...) trả null. */
export function phanTichSuKien(body: unknown): SuKienZalo | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, any>;
  const ten = typeof b.event_name === 'string' ? b.event_name : '';
  if (!ten.startsWith('user_send_')) return null;
  const userId = b.sender?.id;
  if (typeof userId !== 'string' || !userId) return null;
  const msgId = typeof b.message?.msg_id === 'string' ? b.message.msg_id : null;
  const timestamp = b.timestamp === undefined || b.timestamp === null ? '' : String(b.timestamp);
  if (ten === 'user_send_text') {
    const text = typeof b.message?.text === 'string' ? b.message.text.trim() : '';
    if (!text) return null;
    return { userId, msgId, text: text.slice(0, 4000), laText: true, tenSuKien: ten, timestamp };
  }
  const loai = TEN_LOAI[ten] ?? 'nội dung khác';
  const kem = typeof b.message?.text === 'string' && b.message.text.trim() ? `${b.message.text.trim()} ` : '';
  return { userId, msgId, text: `${kem}[Khách gửi ${loai} qua Zalo, xem trên Zalo OA]`.slice(0, 4000), laText: false, tenSuKien: ten, timestamp };
}
