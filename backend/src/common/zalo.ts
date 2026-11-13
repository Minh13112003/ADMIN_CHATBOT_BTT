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

export type DinhKemZalo = { loai: string; url: string; ten: string | null };

const https = (x: unknown): x is string => typeof x === 'string' && /^https:\/\//.test(x) && x.length <= 2000;

/**
 * Tệp đính kèm trong sự kiện webhook (ảnh, tệp, sticker, ảnh động...). Định dạng theo mô tả của Zalo, chưa kiểm chứng:
 * mỗi phần tử `message.attachments[]` có `type` và `payload.{url|thumbnail, name}`. Thiếu thì trả mảng rỗng.
 */
export function layDinhKem(body: unknown): DinhKemZalo[] {
  const m = (body as { message?: { attachments?: unknown } } | null)?.message;
  if (!Array.isArray(m?.attachments)) return [];
  const ra: DinhKemZalo[] = [];
  for (const a of m!.attachments as Record<string, any>[]) {
    if (!a || typeof a !== 'object') continue;
    const p = (a.payload ?? {}) as Record<string, any>;
    const url = [p.url, p.thumbnail, p.href].find(https);
    if (!url) continue;
    ra.push({ loai: typeof a.type === 'string' ? a.type : 'file', url, ten: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 200) : null });
  }
  return ra;
}

/** Khách trả lời (trích) một tin: mã tin được trích nếu Zalo gửi kèm (chưa kiểm chứng tên trường), thiếu thì null. */
export function layTrich(body: unknown): { msgId: string | null; text: string | null } {
  const m = ((body as { message?: Record<string, any> } | null)?.message ?? {}) as Record<string, any>;
  const q = (m.quote ?? m.quote_message ?? m.reply_to ?? {}) as Record<string, any>;
  const id = [m.quote_msg_id, q.msg_id, q.message_id].find((x) => typeof x === 'string' && x);
  const text = [q.text, q.message, m.quote_text].find((x) => typeof x === 'string' && x.trim());
  return { msgId: typeof id === 'string' ? id : null, text: typeof text === 'string' ? text.trim().slice(0, 300) : null };
}

export type TinOa = { userId: string; msgId: string | null; text: string; tenSuKien: string; timestamp: string };

/** Tin do chính OA gửi (nhân viên trả lời ngay trên ứng dụng Zalo): người nhận là khách. Không phải oa_send_* thì null. */
export function phanTichOa(body: unknown): TinOa | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, any>;
  const ten = typeof b.event_name === 'string' ? b.event_name : '';
  if (!ten.startsWith('oa_send_')) return null;
  const userId = b.recipient?.id;
  if (typeof userId !== 'string' || !userId) return null;
  const msgId = typeof b.message?.msg_id === 'string' ? b.message.msg_id : null;
  const chu = typeof b.message?.text === 'string' ? b.message.text.trim() : '';
  const loai = ten.replace('oa_send_', '');
  const text = chu || `[OA gửi ${TEN_LOAI[`user_send_${loai}`] ?? 'nội dung khác'} qua Zalo, xem trên Zalo OA]`;
  return { userId, msgId, text: text.slice(0, 4000), tenSuKien: ten, timestamp: b.timestamp === undefined ? '' : String(b.timestamp) };
}

const CAM_XUC: Record<string, string> = {
  '/-heart': 'thả tim', '/-strong': 'thích', ':>': 'haha', ':o': 'wow', ':-((': 'buồn', ':-h': 'phẫn nộ', ':-*': 'hôn', '/-shit': 'không thích', '/-rose': 'tặng hoa', '/-break': 'tan vỡ',
};

/** Khách thả cảm xúc vào một tin (sự kiện chứa "react", tên trường chưa kiểm chứng). Không phải thì null. */
export function phanTichPhanUng(body: unknown): { userId: string; msgId: string | null; camXuc: string } | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, any>;
  const ten = typeof b.event_name === 'string' ? b.event_name : '';
  if (!/react/i.test(ten)) return null;
  const userId = b.sender?.id;
  if (typeof userId !== 'string' || !userId) return null;
  const m = (b.message ?? {}) as Record<string, any>;
  const ma = [m.react_icon, m.reaction, m.icon, b.react_icon].find((x) => typeof x === 'string' && x);
  const msgId = [m.msg_id, m.react_msg_id, m.message_id].find((x) => typeof x === 'string' && x);
  return { userId, msgId: typeof msgId === 'string' ? msgId : null, camXuc: (typeof ma === 'string' && CAM_XUC[ma]) || 'thả cảm xúc' };
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

export type ChatGanDay = { userId: string; ten: string | null; anh: string | null; gio: Date; text: string };

/**
 * Chuẩn hoá danh sách các cuộc trò chuyện gần đây của OA (mỗi phần tử là tin mới nhất của một khách; định dạng chưa đối chiếu tài liệu chính thức).
 * Khách là bên KHÔNG phải OA: OA là `oaId` nếu có trong dữ liệu, không thì mã xuất hiện ở nhiều tin nhất. Mỗi khách một dòng, mới nhất trước.
 */
export function chuanHoaChatGanDay(raw: unknown, oaId?: string): ChatGanDay[] {
  if (!Array.isArray(raw)) return [];
  const tin = raw.filter((x): x is Record<string, any> => !!x && typeof x === 'object' && x.from_id !== undefined && x.to_id !== undefined);
  if (!tin.length) return [];
  const dem = new Map<string, number>();
  for (const m of tin) for (const id of [String(m.from_id), String(m.to_id)]) dem.set(id, (dem.get(id) ?? 0) + 1);
  const oa = oaId && dem.has(oaId) ? oaId : [...dem.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const theoKhach = new Map<string, ChatGanDay>();
  for (const m of tin) {
    const tuOa = String(m.from_id) === oa;
    const userId = tuOa ? String(m.to_id) : String(m.from_id);
    if (!userId || userId === oa) continue;
    const ms = Number(m.time);
    const gio = Number.isFinite(ms) && ms > 0 ? new Date(ms) : new Date(NaN);
    if (Number.isNaN(gio.getTime())) continue;
    const ten = (tuOa ? m.to_display_name : m.from_display_name) as unknown;
    const anh = (tuOa ? m.to_avatar : m.from_avatar) as unknown;
    const cu = theoKhach.get(userId);
    if (cu && cu.gio >= gio) continue;
    theoKhach.set(userId, {
      userId,
      ten: typeof ten === 'string' && ten.trim() ? ten.trim().slice(0, 120) : cu?.ten ?? null,
      anh: typeof anh === 'string' && /^https:\/\//.test(anh) && anh.length <= 1000 ? anh : cu?.anh ?? null,
      gio,
      text: typeof m.message === 'string' ? m.message.slice(0, 4000) : '',
    });
  }
  return [...theoKhach.values()].sort((a, b) => b.gio.getTime() - a.gio.getTime());
}
