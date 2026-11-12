import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import { giaiMa, maHoa } from '../common/secret-box';
import { chuanHoaLichSu, taoPkce, type TinLichSu } from '../common/zalo';
import { PrismaService } from '../prisma/prisma.service';

const OAUTH = 'https://oauth.zaloapp.com/v4/oa';
const OPENAPI = 'https://openapi.zalo.me';
const HAN_STATE_MS = 10 * 60_000;
const TRUOC_HAN_MS = 20 * 60_000; // Làm mới token khi còn dưới 20 phút (access token Zalo sống ngắn, có thể chỉ 15 phút)

type Tokens = { access_token?: string; refresh_token?: string; expires_in?: string | number; error?: number; error_name?: string; error_reason?: string; message?: string };

/**
 * Kết nối Zalo OA: lấy/làm mới token qua OAuth, gửi tin cho khách, đọc hồ sơ khách.
 * Địa chỉ và tên trường theo mô tả của Zalo ở nguồn bên thứ ba, chưa đối chiếu tài liệu chính thức:
 * lỗi thật từ Zalo được ghi vào log và trả về nguyên văn để dễ sửa.
 */
@Injectable()
export class ZaloService {
  private log = new Logger('Zalo');
  private dangLamMoi: Promise<void> | null = null;
  private cho = new Map<string, { verifier: string; het: number }>();

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  private khoa() {
    const k = this.config.get<string>('ENCRYPTION_KEY');
    if (!k || k.length < 32) throw new BadRequestException('Máy chủ chưa cấu hình ENCRYPTION_KEY');
    return k;
  }

  /** Địa chỉ gốc của trang (cùng tên miền với giao diện). */
  goc() {
    return (this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3002').split(',')[0].trim().replace(/\/$/, '');
  }
  diaChiWebhook() { return `${this.goc()}/api/v1/webhooks/zalo`; }
  diaChiCallback() { return `${this.goc()}/api/v1/channel-settings/zalo/callback`; }

  async doc(): Promise<Record<string, string>> {
    const k = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    if (k.length < 32) return {};
    const dong = await this.prisma.channelSecret.findMany({ where: { channel: 'ZALO' } });
    const ra: Record<string, string> = {};
    for (const d of dong) {
      const v = giaiMa(d.valueEnc, k);
      if (v !== null) ra[d.name] = v;
    }
    return ra;
  }

  private async ghi(gia: Record<string, string>, nguoiId?: string) {
    const k = this.khoa();
    await this.prisma.$transaction(
      Object.entries(gia).filter(([, v]) => v).map(([name, v]) => {
        const valueEnc = maHoa(v, k);
        return this.prisma.channelSecret.upsert({
          where: { channel_name: { channel: 'ZALO', name } },
          create: { channel: 'ZALO', name, valueEnc, updatedById: nguoiId },
          update: { valueEnc, updatedById: nguoiId },
        });
      }),
    );
  }

  /** Bước 1: link để quản trị viên OA bấm đồng ý cấp quyền. */
  async taoLinkCapQuyen() {
    const c = await this.doc();
    if (!c.appId) throw new BadRequestException('Chưa nhập App ID Zalo');
    const { verifier, challenge } = taoPkce();
    const state = randomBytes(24).toString('hex');
    const bay = Date.now();
    for (const [s, v] of this.cho) if (v.het < bay) this.cho.delete(s);
    this.cho.set(state, { verifier, het: bay + HAN_STATE_MS });
    const q = new URLSearchParams({ app_id: c.appId, redirect_uri: this.diaChiCallback(), code_challenge: challenge, code_challenge_method: 'S256', state });
    return `${OAUTH}/permission?${q}`;
  }

  /** Bước 2: Zalo quay về kèm `code`; đổi lấy access token và refresh token rồi lưu mã hoá. */
  async doiMaLayToken(code: string, state: string, oaId?: string) {
    const phien = this.cho.get(state);
    this.cho.delete(state);
    if (!phien || phien.het < Date.now()) throw new BadRequestException('Phiên kết nối đã hết hạn, bấm "Kết nối với Zalo" lại');
    const c = await this.doc();
    if (!c.appId || !c.appSecret) throw new BadRequestException('Chưa nhập App ID và khoá bí mật của ứng dụng');
    const t = await this.goiToken({ app_id: c.appId, code, grant_type: 'authorization_code', code_verifier: phien.verifier }, c.appSecret);
    await this.luuToken(t, oaId);
  }

  /** Làm mới token. Refresh token của Zalo đổi mỗi lần dùng nên phải lưu lại ngay, và không chạy hai lần cùng lúc. */
  lamMoiToken(): Promise<void> {
    if (!this.dangLamMoi) {
      this.dangLamMoi = this.lamMoiThat().finally(() => { this.dangLamMoi = null; });
    }
    return this.dangLamMoi;
  }

  private async lamMoiThat() {
    const c = await this.doc();
    if (!c.appId || !c.appSecret || !c.refreshToken) throw new BadRequestException('Chưa có refresh token Zalo');
    const t = await this.goiToken({ app_id: c.appId, refresh_token: c.refreshToken, grant_type: 'refresh_token' }, c.appSecret);
    await this.luuToken(t);
  }

  private async goiToken(body: Record<string, string>, appSecret: string): Promise<Tokens> {
    let t: Tokens;
    try {
      const r = await fetch(`${OAUTH}/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', secret_key: appSecret },
        body: new URLSearchParams(body),
        signal: AbortSignal.timeout(15_000),
      });
      t = (await r.json()) as Tokens;
    } catch (e) {
      this.log.error(`Gọi Zalo lấy token lỗi mạng: ${(e as Error).message}`);
      throw new BadRequestException('Không kết nối được tới Zalo, thử lại sau');
    }
    if (!t.access_token || !t.refresh_token) {
      this.log.error(`Zalo từ chối cấp token: ${JSON.stringify({ error: t.error, name: t.error_name, reason: t.error_reason, message: t.message })}`);
      throw new BadRequestException(`Zalo từ chối: ${t.error_reason ?? t.error_name ?? t.message ?? 'không rõ lý do'}`);
    }
    return t;
  }

  private async luuToken(t: Tokens, oaId?: string) {
    const giay = Number(t.expires_in) || 3600;
    await this.ghi({
      accessToken: t.access_token!,
      refreshToken: t.refresh_token!,
      accessTokenExpiresAt: String(Date.now() + giay * 1000),
      ...(oaId ? { oaId } : {}),
    });
    this.log.log('Đã lưu token Zalo mới');
  }

  /** Mỗi 5 phút: token còn dưới 20 phút thì làm mới. Lỗi chỉ ghi log. */
  @Cron('*/5 * * * *')
  async tuLamMoi() {
    try {
      const c = await this.doc();
      if (!c.refreshToken || !c.appId || !c.appSecret) return;
      const het = Number(c.accessTokenExpiresAt);
      if (Number.isFinite(het) && het - Date.now() > TRUOC_HAN_MS) return;
      await this.lamMoiToken();
    } catch (e) {
      this.log.warn(`Tự làm mới token Zalo không được: ${(e as Error).message}`);
    }
  }

  /** Gọi OpenAPI; token hết hạn thì làm mới một lần rồi gọi lại. */
  private async goiApi(url: string, init: { method: 'GET' | 'POST'; body?: unknown }, thuLai = true): Promise<any> {
    const c = await this.doc();
    if (!c.accessToken) throw new BadRequestException('Zalo chưa được kết nối (thiếu access token)');
    const r = await fetch(url, {
      method: init.method,
      headers: { access_token: c.accessToken, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const j: any = await r.json().catch(() => ({}));
    // -216: access token hết hạn hoặc không hợp lệ.
    if (j?.error === -216 && thuLai && c.refreshToken) {
      await this.lamMoiToken();
      return this.goiApi(url, init, false);
    }
    if (j?.error) {
      this.log.error(`Zalo báo lỗi ${j.error}: ${j.message ?? ''}`);
      throw new BadRequestException(`Zalo báo lỗi ${j.error}: ${j.message ?? 'không rõ'}`);
    }
    return j;
  }

  /** Gửi tin chữ tư vấn cho khách. Zalo chỉ cho nhắn trong khung thời gian sau lần khách tương tác cuối. */
  async guiTin(zaloUserId: string, text: string) {
    await this.goiApi(`${OPENAPI}/v3.0/oa/message/cs`, { method: 'POST', body: { recipient: { user_id: zaloUserId }, message: { text } } });
  }

  /** Tên và ảnh đại diện của khách; lỗi thì trả rỗng (không chặn việc nhận tin). Thử API v3.0 trước, rồi v2.0. */
  async hoSoKhach(zaloUserId: string): Promise<{ ten: string | null; anh: string | null }> {
    const data = encodeURIComponent(JSON.stringify({ user_id: zaloUserId }));
    for (const duong of [`/v3.0/oa/user/detail?data=${data}`, `/v2.0/oa/getprofile?data=${data}`]) {
      try {
        const j = await this.goiApi(`${OPENAPI}${duong}`, { method: 'GET' });
        const d = j?.data ?? {};
        const ten = typeof d.display_name === 'string' && d.display_name.trim() ? d.display_name.trim().slice(0, 120) : null;
        const anhNho = d.avatars && typeof d.avatars === 'object' ? (d.avatars['240'] ?? d.avatars['120']) : null;
        const anhRaw = typeof anhNho === 'string' ? anhNho : typeof d.avatar === 'string' ? d.avatar : null;
        const anh = anhRaw && /^https:\/\//.test(anhRaw) && anhRaw.length <= 1000 ? anhRaw : null;
        if (ten || anh) return { ten, anh };
      } catch (e) {
        this.log.warn(`Không lấy được hồ sơ khách Zalo qua ${duong.split('?')[0]}: ${(e as Error).message}`);
      }
    }
    return { ten: null, anh: null };
  }

  /** Kéo lịch sử tin với một khách (mỗi lần tối đa 10 tin, lùi dần), cũ nhất trước. Lỗi thì ném ra để người dùng thấy lý do. */
  async layLichSu(zaloUserId: string, toiDa = 50): Promise<TinLichSu[]> {
    const tat: TinLichSu[] = [];
    for (let offset = 0; offset < toiDa; offset += 10) {
      const data = encodeURIComponent(JSON.stringify({ user_id: zaloUserId, offset, count: 10 }));
      const j = await this.goiApi(`${OPENAPI}/v2.0/oa/conversation?data=${data}`, { method: 'GET' });
      const mang = chuanHoaLichSu(j?.data, zaloUserId);
      tat.push(...mang);
      if (!Array.isArray(j?.data) || j.data.length < 10) break;
    }
    const gap = new Map(tat.map((t) => [t.msgId, t]));
    return [...gap.values()].sort((a, b) => a.thoiGian.getTime() - b.thoiGian.getTime());
  }
}
