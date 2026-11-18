import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GIOI_HAN_TEP_TOI_DA } from '../common/attachments';
import { GRAPH, SU_KIEN_WEBHOOK, appSecretProof, chiaDoan, loiGraph } from '../common/facebook';
import { giaiMa, maHoa } from '../common/secret-box';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService, type TepDaLuu } from '../storage/attachments.service';

/** Tên dòng trong `channel_secrets` ghi lần kiểm tra kết nối thành công gần nhất (không phải trường admin nhập). */
export const KET_NOI_LUC = 'ketNoiLuc';
type BuocKiemTra = { ten: string; ok: boolean; loi?: string };
export type KetQuaKiemTra = { ok: boolean; trang: { id: string; name: string } | null; buoc: BuocKiemTra[]; loi: string | null };

/**
 * Kết nối Facebook Messenger: gọi Graph API bằng Page access token (kèm `appsecret_proof`), gửi tin, đọc hồ sơ khách,
 * và tự kiểm tra + tự đăng ký webhook khi admin lưu thông tin. Tên API theo tài liệu Messenger Platform, chưa chạy với Trang thật.
 */
@Injectable()
export class FacebookService {
  private log = new Logger('Facebook');
  private guiLoi = { ngay: '', so: 0, lyDo: '' };

  constructor(private prisma: PrismaService, private config: ConfigService, private tep: AttachmentsService) {}

  goc() {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3002').split(',')[0].trim().replace(/\/$/, '');
  }
  diaChiWebhook() { return `${this.goc()}/api/v1/webhooks/facebook`; }

  private khoa() {
    const k = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    if (k.length < 32) throw new BadRequestException('Máy chủ chưa cấu hình ENCRYPTION_KEY');
    return k;
  }

  async doc(): Promise<Record<string, string>> {
    const k = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    if (k.length < 32) return {};
    const dong = await this.prisma.channelSecret.findMany({ where: { channel: 'FACEBOOK' } });
    const ra: Record<string, string> = {};
    for (const d of dong) {
      const v = giaiMa(d.valueEnc, k);
      if (v !== null) ra[d.name] = v;
    }
    return ra;
  }

  /** Gọi Graph API bằng Page token. Lỗi thì ném BadRequest với câu tiếng Việt (xem `loiGraph`). */
  private async goi(duong: string, tuy: { method?: 'GET' | 'POST'; json?: unknown; form?: FormData; query?: Record<string, string>; c?: Record<string, string> } = {}) {
    const c = tuy.c ?? (await this.doc());
    if (!c.pageAccessToken || !c.appSecret) throw new BadRequestException('Facebook chưa được kết nối (thiếu Page access token hoặc App Secret)');
    const q = new URLSearchParams({ ...(tuy.query ?? {}), access_token: c.pageAccessToken, appsecret_proof: appSecretProof(c.pageAccessToken, c.appSecret) });
    const r = await fetch(`${GRAPH}${duong}?${q}`, {
      method: tuy.method ?? 'GET',
      ...(tuy.json !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(tuy.json) } : tuy.form ? { body: tuy.form } : {}),
      signal: AbortSignal.timeout(60_000),
    });
    const j = (await r.json().catch(() => ({}))) as Record<string, any>;
    if (!r.ok || j.error) {
      const loi = loiGraph(j);
      if (duong.includes('/messages')) {
        const ngay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
        this.guiLoi = { ngay, so: (this.guiLoi.ngay === ngay ? this.guiLoi.so : 0) + 1, lyDo: loi };
      }
      this.log.error(`Facebook ${duong.split('?')[0]}: ${loi}`);
      throw new BadRequestException(loi);
    }
    return j;
  }

  /**
   * Kiểm tra kết nối sau khi admin lưu thông tin: (1) token đúng Trang và khớp App Secret, (2) đăng ký webhook của ứng dụng về máy chủ này
   * (Meta gọi thử ngay địa chỉ webhook với mã xác minh), (3) đăng ký Trang nhận sự kiện tin nhắn. Thành công thì ghi mốc để trang Kênh kết nối hiện "Đã kết nối".
   */
  async kiemTraKetNoi(): Promise<KetQuaKiemTra> {
    const c = await this.doc();
    const buoc: BuocKiemTra[] = [];
    const ketThuc = async (loi: string | null, trang: KetQuaKiemTra['trang'] = null): Promise<KetQuaKiemTra> => {
      if (loi) await this.prisma.channelSecret.deleteMany({ where: { channel: 'FACEBOOK', name: KET_NOI_LUC } });
      else {
        const valueEnc = maHoa(JSON.stringify({ luc: new Date().toISOString(), trang: trang?.name ?? '' }), this.khoa());
        await this.prisma.channelSecret.upsert({ where: { channel_name: { channel: 'FACEBOOK', name: KET_NOI_LUC } }, create: { channel: 'FACEBOOK', name: KET_NOI_LUC, valueEnc }, update: { valueEnc } });
      }
      this.log.log(loi ? `Kiểm tra kết nối thất bại: ${loi}` : `Kết nối thành công với Trang "${trang?.name}"`);
      return { ok: !loi, trang, buoc, loi };
    };
    const thieu = [['appId', 'App ID'], ['pageId', 'ID Trang'], ['appSecret', 'App Secret'], ['pageAccessToken', 'Page access token'], ['verifyToken', 'Mã xác minh webhook']].filter(([k]) => !c[k]).map(([, t]) => t);
    if (thieu.length) return ketThuc(`Còn thiếu: ${thieu.join(', ')}.`);

    let trang: { id: string; name: string };
    try {
      const me = await this.goi('/me', { query: { fields: 'id,name' }, c });
      trang = { id: String(me.id ?? ''), name: String(me.name ?? '') };
      if (trang.id !== c.pageId) throw new BadRequestException(`Token này thuộc "${trang.name}" (ID ${trang.id}), không khớp ID Trang đã nhập. Có thể bạn đã dán token người dùng thay vì Page access token.`);
      buoc.push({ ten: `Token đúng Trang "${trang.name}" và khớp App Secret`, ok: true });
    } catch (e) {
      buoc.push({ ten: 'Kiểm tra Page access token và App Secret', ok: false, loi: (e as Error).message });
      return ketThuc((e as Error).message);
    }

    const webhook = this.diaChiWebhook();
    try {
      if (!webhook.startsWith('https://')) throw new BadRequestException(`Địa chỉ webhook phải là https, hiện là ${webhook} (kiểm tra FRONTEND_URL trên máy chủ).`);
      const q = new URLSearchParams({ object: 'page', callback_url: webhook, verify_token: c.verifyToken, fields: SU_KIEN_WEBHOOK, access_token: `${c.appId}|${c.appSecret}` });
      const r = await fetch(`${GRAPH}/${encodeURIComponent(c.appId)}/subscriptions?${q}`, { method: 'POST', signal: AbortSignal.timeout(60_000) });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      if (!r.ok || j.error) throw new BadRequestException(`${loiGraph(j)} (kiểm tra App ID, và địa chỉ webhook phải mở được từ Internet)`);
      buoc.push({ ten: 'Đăng ký webhook, Meta đã gọi thử máy chủ thành công', ok: true });
    } catch (e) {
      buoc.push({ ten: 'Đăng ký webhook về máy chủ này', ok: false, loi: (e as Error).message });
      return ketThuc((e as Error).message, trang);
    }

    try {
      await this.goi(`/${encodeURIComponent(c.pageId)}/subscribed_apps`, { method: 'POST', query: { subscribed_fields: SU_KIEN_WEBHOOK }, c });
      buoc.push({ ten: 'Trang đã đăng ký nhận tin nhắn qua ứng dụng', ok: true });
    } catch (e) {
      buoc.push({ ten: 'Đăng ký Trang nhận tin nhắn', ok: false, loi: (e as Error).message });
      return ketThuc((e as Error).message, trang);
    }
    return ketThuc(null, trang);
  }

  async trangThai() {
    const c = await this.doc();
    let ketNoi: { luc: string; trang: string } | null = null;
    try {
      ketNoi = c[KET_NOI_LUC] ? JSON.parse(c[KET_NOI_LUC]) : null;
    } catch {
      ketNoi = null;
    }
    const ngay = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    return { ketNoi, guiLoiHomNay: this.guiLoi.ngay === ngay ? this.guiLoi.so : 0, loiGuiGanNhat: this.guiLoi.ngay === ngay ? this.guiLoi.lyDo : null };
  }

  /** Gửi tin chữ trả lời khách (trong khung 24 giờ). Tin dài hơn 2.000 ký tự được cắt thành nhiều tin. */
  async guiTin(psid: string, text: string) {
    for (const doan of chiaDoan(text)) {
      await this.goi('/me/messages', { method: 'POST', json: { recipient: { id: psid }, messaging_type: 'RESPONSE', message: { text: doan } } });
    }
  }

  /** Gửi ảnh hoặc tệp (multipart `filedata`); chữ kèm theo gửi thành tin riêng sau tệp. */
  async guiTep(psid: string, tep: { data: Buffer; type: string; name: string; anh: boolean }, chu: string) {
    const form = new FormData();
    form.append('recipient', JSON.stringify({ id: psid }));
    form.append('messaging_type', 'RESPONSE');
    form.append('message', JSON.stringify({ attachment: { type: tep.anh ? 'image' : 'file', payload: { is_reusable: false } } }));
    form.append('filedata', new Blob([new Uint8Array(tep.data)], { type: tep.type }), tep.name);
    await this.goi('/me/messages', { method: 'POST', form });
    if (chu) await this.guiTin(psid, chu);
  }

  /** Tên và ảnh đại diện của khách (User Profile API); lỗi thì trả rỗng, không chặn việc nhận tin. */
  async hoSoKhach(psid: string): Promise<{ ten: string | null; anh: string | null }> {
    try {
      const j = await this.goi(`/${encodeURIComponent(psid)}`, { query: { fields: 'name,first_name,last_name,profile_pic' } });
      const ten = (typeof j.name === 'string' && j.name.trim()) || [j.last_name, j.first_name].filter((x) => typeof x === 'string' && x.trim()).join(' ').trim();
      const anh = typeof j.profile_pic === 'string' && /^https:\/\//.test(j.profile_pic) && j.profile_pic.length <= 1000 ? j.profile_pic : null;
      return { ten: ten ? ten.slice(0, 120) : null, anh };
    } catch (e) {
      this.log.warn(`Không lấy được hồ sơ khách Facebook: ${(e as Error).message}`);
      return { ten: null, anh: null };
    }
  }

  /** Tải ảnh/PDF khách gửi về máy chủ (link Facebook có hạn). Không được thì null để ghi dòng chữ thay thế. */
  async taiTep(url: string, ten?: string | null): Promise<TepDaLuu | null> {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (Number(r.headers.get('content-length') ?? 0) > GIOI_HAN_TEP_TOI_DA) throw new Error('quá lớn');
      const buffer = Buffer.from(await r.arrayBuffer());
      if (buffer.length > GIOI_HAN_TEP_TOI_DA) throw new Error('quá lớn');
      return await this.tep.luu({ buffer, originalname: ten ?? undefined }, { choGif: true });
    } catch (e) {
      this.log.warn(`Không lưu được tệp từ Facebook: ${(e as Error).message}`);
      return null;
    }
  }
}
