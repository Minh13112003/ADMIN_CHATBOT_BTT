import { createHmac, timingSafeEqual } from 'crypto';

/** Phiên bản Graph API. Gọi bản cũ đã hết hạn thì Meta tự nâng lên bản cũ nhất còn hỗ trợ, nên chỉ cần đổi khi muốn dùng tính năng mới. */
export const GRAPH = 'https://graph.facebook.com/v23.0';
/** Sự kiện webhook đăng ký cho Trang: tin khách, khách bấm nút, tin Trang gửi (để ghi tin nhân viên trả lời trên Meta Business Suite). */
export const SU_KIEN_WEBHOOK = 'messages,messaging_postbacks,message_echoes';
/** Messenger giới hạn 2.000 ký tự mỗi tin chữ. */
export const DO_DAI_TIN_TOI_DA = 2000;

/** So chữ ký `X-Hub-Signature-256: sha256=<hex>` = HMAC-SHA256(App Secret, nội dung gốc từng byte). */
export function chuKyFacebookHopLe(header: string | undefined, goc: Buffer | string, appSecret: string): boolean {
  if (!header || !appSecret) return false;
  const m = /^sha256=([0-9a-f]{64})$/i.exec(header.trim());
  if (!m) return false;
  const tinh = createHmac('sha256', appSecret).update(goc).digest();
  const nhan = Buffer.from(m[1], 'hex');
  return nhan.length === tinh.length && timingSafeEqual(nhan, tinh);
}

/** `appsecret_proof` gửi kèm mỗi lời gọi bằng Page token: Meta từ chối nếu App Secret không khớp, nên dùng được để kiểm tra khoá. */
export function appSecretProof(token: string, appSecret: string): string {
  return createHmac('sha256', appSecret).update(token).digest('hex');
}

/** So 2 chuỗi bí mật không lộ thời gian (mã xác minh webhook). */
export function bangNhau(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export type DinhKemFb = { loai: string; url: string; ten: string | null };
export type SuKienFb =
  | { loai: 'khach'; psid: string; mid: string; text: string; tep: DinhKemFb[]; traLoiMid: string | null }
  | { loai: 'trang'; psid: string; mid: string; text: string; tep: DinhKemFb[]; appId: string | null };

const chu = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

function docDinhKem(ds: unknown): DinhKemFb[] {
  if (!Array.isArray(ds)) return [];
  const ra: DinhKemFb[] = [];
  for (const d of ds as Record<string, unknown>[]) {
    const p = (d?.payload ?? {}) as Record<string, unknown>;
    const url = chu(p.url);
    if (!/^https:\/\//.test(url)) continue;
    // Sticker Messenger đến dạng ảnh có `sticker_id`.
    const loai = p.sticker_id ? 'sticker' : chu(d.type) || 'file';
    ra.push({ loai, url, ten: chu(p.title) || chu(d.title) || null });
  }
  return ra;
}

/**
 * Đọc sự kiện webhook Messenger (`object: "page"`, `entry[].messaging[]`). Bỏ qua đã xem, đã nhận, cảm xúc và loại chưa hỗ trợ.
 * Khách bấm nút (postback) được coi như khách gõ đúng chữ trên nút.
 */
export function phanTichFacebook(body: unknown): SuKienFb[] {
  const b = (body ?? {}) as Record<string, unknown>;
  if (b.object !== 'page' || !Array.isArray(b.entry)) return [];
  const ra: SuKienFb[] = [];
  for (const e of b.entry as Record<string, unknown>[]) {
    if (!Array.isArray(e?.messaging)) continue;
    for (const s of e.messaging as Record<string, unknown>[]) {
      const gui = chu((s.sender as Record<string, unknown> | undefined)?.id);
      const nhan = chu((s.recipient as Record<string, unknown> | undefined)?.id);
      const m = s.message as Record<string, unknown> | undefined;
      if (m && typeof m === 'object') {
        const mid = chu(m.mid);
        const text = chu(m.text);
        const tep = docDinhKem(m.attachments);
        if (!mid || (!text && !tep.length)) continue;
        if (m.is_echo === true) {
          if (nhan) ra.push({ loai: 'trang', psid: nhan, mid, text, tep, appId: m.app_id === undefined || m.app_id === null ? null : String(m.app_id) });
        } else if (gui) {
          const traLoi = chu((m.reply_to as Record<string, unknown> | undefined)?.mid);
          ra.push({ loai: 'khach', psid: gui, mid, text, tep, traLoiMid: traLoi || null });
        }
        continue;
      }
      const pb = s.postback as Record<string, unknown> | undefined;
      if (pb && typeof pb === 'object' && gui) {
        const text = chu(pb.title) || chu(pb.payload);
        const mid = chu(pb.mid) || `pb-${gui}-${String(s.timestamp ?? '')}`;
        if (text) ra.push({ loai: 'khach', psid: gui, mid, text, tep: [], traLoiMid: null });
      }
    }
  }
  return ra;
}

/** Cắt tin dài thành các đoạn không quá `toiDa` ký tự, ưu tiên cắt ở xuống dòng rồi khoảng trắng. */
export function chiaDoan(text: string, toiDa = DO_DAI_TIN_TOI_DA): string[] {
  const ra: string[] = [];
  let con = text;
  while (con.length > toiDa) {
    const dau = con.slice(0, toiDa);
    let cat = dau.lastIndexOf('\n');
    if (cat < toiDa / 2) cat = dau.lastIndexOf(' ');
    if (cat < toiDa / 2) cat = toiDa;
    ra.push(con.slice(0, cat).trimEnd());
    con = con.slice(cat).trimStart();
  }
  if (con) ra.push(con);
  return ra;
}

/** Lỗi Graph API thành câu tiếng Việt cho admin/sale. Mã lỗi theo tài liệu Messenger Platform. */
export function loiGraph(j: unknown): string {
  const e = ((j ?? {}) as Record<string, unknown>).error as Record<string, unknown> | undefined;
  if (!e) return 'Facebook không trả lời đúng định dạng';
  const code = Number(e.code);
  const sub = Number(e.error_subcode);
  const msg = chu(e.message);
  if (code === 190) return 'Page access token không hợp lệ hoặc đã hết hạn. Tạo lại token trong mục Cài đặt API Messenger rồi nhập lại.';
  if (code === 100 && /appsecret_proof/i.test(msg)) return 'Khoá bí mật của ứng dụng (App Secret) không khớp với token. Kiểm tra lại App Secret trong Cài đặt ứng dụng → Cơ bản.';
  if (code === 10 && sub === 2018278) return 'Đã quá 24 giờ từ tin cuối của khách nên Messenger không cho gửi. Chờ khách nhắn lại, hoặc trả lời trên Meta Business Suite.';
  if (code === 551) return 'Người này hiện không nhận được tin nhắn từ Trang.';
  if (code === 200 || code === 10) return `Ứng dụng chưa có đủ quyền: ${msg || 'không rõ'}`;
  if (code === 4 || code === 32 || code === 613) return 'Facebook đang giới hạn số lần gọi, thử lại sau ít phút.';
  return `Facebook báo lỗi ${Number.isFinite(code) ? code : ''}${sub ? `/${sub}` : ''}: ${msg || 'không rõ'}`;
}
