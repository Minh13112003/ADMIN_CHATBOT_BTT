import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

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

/** Mọi cách xếp thứ tự của các tập con khác rỗng. */
function xepThuTu<T>(mang: T[]): T[][] {
  if (mang.length <= 1) return [mang];
  return mang.flatMap((x, i) => xepThuTu([...mang.slice(0, i), ...mang.slice(i + 1)]).map((r) => [x, ...r]));
}

/**
 * CHẨN ĐOÁN: thử mọi cách ghép (A=App ID, R=nội dung gốc, T=timestamp, K=khoá) bằng sha256 và HMAC-sha256 với từng khoá đang có,
 * trả về tên các cách khớp với chữ ký Zalo gửi (không bao giờ trả về khoá). Dùng để biết Zalo ký thế nào khi chữ ký không khớp.
 */
export function thuCongThuc(header: string | undefined, appId: string, raw: string, ts: string, khoa: Record<string, string>): string[] {
  if (!header) return [];
  const nhan = header.trim().replace(/^mac=/i, '').toLowerCase();
  const sha = (x: string) => createHash('sha256').update(x).digest('hex');
  const hmac = (k: string, x: string) => createHmac('sha256', k).update(x).digest('hex');
  const phan: Record<string, string> = { A: appId, R: raw, T: ts };
  const ra: string[] = [];
  const tapCon = (bat: string[], tuyChon: string[]) => {
    const ds: string[][] = [];
    for (let m = 0; m < 1 << tuyChon.length; m++) ds.push([...bat, ...tuyChon.filter((_, i) => m & (1 << i))]);
    return ds;
  };
  for (const [ten, k] of Object.entries(khoa)) {
    if (!k) continue;
    // sha256(ghép các phần, trong đó có R và K)
    for (const ds of tapCon(['R', 'K'], ['A', 'T'])) {
      for (const tt of xepThuTu(ds)) {
        if (sha(tt.map((x) => (x === 'K' ? k : phan[x])).join('')) === nhan) ra.push(`${ten}:sha(${tt.join('+')})`);
      }
    }
    // hmac(K, ghép các phần có R)
    for (const ds of tapCon(['R'], ['A', 'T'])) {
      for (const tt of xepThuTu(ds)) {
        if (hmac(k, tt.map((x) => phan[x]).join('')) === nhan) ra.push(`${ten}:hmac(K,${tt.join('+')})`);
      }
    }
  }
  return ra;
}

export type TinLichSu = { msgId: string; tuKhach: boolean; text: string; thoiGian: Date };

/**
 * Chuẩn hoá danh sách tin của API lịch sử hội thoại Zalo (chưa đối chiếu tài liệu chính thức nên đọc rộng rãi):
 * người gửi suy từ from_id so với mã khách (không có thì dùng src: 1 = khách), giờ từ `time` (mili giây) hoặc `sent_time`.
 * Trả về cũ nhất trước; bỏ tin không có mã hoặc không rõ giờ.
 */
export function chuanHoaLichSu(raw: unknown, zaloUserId: string): TinLichSu[] {
  if (!Array.isArray(raw)) return [];
  const ra: TinLichSu[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const m = x as Record<string, any>;
    const msgId = typeof m.message_id === 'string' ? m.message_id : typeof m.msg_id === 'string' ? m.msg_id : '';
    const ms = Number(m.time);
    const gio = Number.isFinite(ms) && ms > 0 ? new Date(ms) : typeof m.sent_time === 'string' ? new Date(m.sent_time) : null;
    if (!msgId || !gio || Number.isNaN(gio.getTime())) continue;
    const tuKhach = m.from_id !== undefined && m.from_id !== null ? String(m.from_id) === zaloUserId : Number(m.src) === 1;
    const chu = typeof m.message === 'string' ? m.message.trim() : '';
    const loai = typeof m.type === 'string' ? m.type : 'text';
    const text = loai === 'text' && chu ? chu : `${chu ? `${chu} ` : ''}[${tuKhach ? 'Khách' : 'OA'} gửi ${loai === 'text' ? 'tin nhắn' : loai} qua Zalo, xem trên Zalo OA]`;
    ra.push({ msgId, tuKhach, text: text.slice(0, 4000), thoiGian: gio });
  }
  return ra.sort((a, b) => a.thoiGian.getTime() - b.thoiGian.getTime());
}
