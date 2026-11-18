import { Controller, ForbiddenException, Get, Headers, HttpCode, Logger, Post, Req, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public, Roles } from '../auth/auth.decorators';
import { bangNhau, chuKyFacebookHopLe, phanTichFacebook, type DinhKemFb, type SuKienFb } from '../common/facebook';
import { Role } from '../generated/prisma/client';
import { IngestService } from '../ingest/ingest.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TepDaLuu } from '../storage/attachments.service';
import { FacebookService } from './facebook.service';

const TEN_CHUA_RO = 'Khách chưa rõ tên';
const TEN_DINH_KEM: Record<string, string> = { image: 'ảnh', sticker: 'sticker', file: 'tệp', video: 'video', audio: 'tin thoại', fallback: 'liên kết', template: 'thẻ' };

/** Kiểm tra kết nối và trạng thái Facebook cho trang Kênh kết nối (chỉ ADMIN). */
@Roles(Role.ADMIN)
@Controller('channel-settings/facebook')
export class FacebookAdminController {
  constructor(private fb: FacebookService) {}

  @Post('test')
  @HttpCode(200)
  kiemTra() {
    return this.fb.kiemTraKetNoi();
  }

  @Get('status')
  trangThai() {
    return this.fb.trangThai();
  }
}

/** Meta gửi tin Messenger của khách về đây. Xem `docs` trong `.claude/rules/integrations.md`, mục Facebook. */
@Controller('webhooks')
export class FacebookWebhookController {
  private log = new Logger('FacebookWebhook');
  constructor(private fb: FacebookService, private ingest: IngestService, private prisma: PrismaService) {}

  /** Meta xác minh địa chỉ webhook: trả lại `hub.challenge` khi mã xác minh khớp với mã admin đã nhập. */
  @Public()
  @Get('facebook')
  async xacMinh(@Req() req: Request, @Res() res: Response) {
    const q = req.query as Record<string, unknown>;
    const lay = (k: string) => {
      const v = q[`hub.${k}`] ?? (q.hub as Record<string, unknown> | undefined)?.[k];
      return typeof v === 'string' ? v : undefined;
    };
    const c = await this.fb.doc();
    if (lay('mode') !== 'subscribe' || !bangNhau(lay('verify_token'), c.verifyToken)) {
      this.log.warn('Từ chối xác minh webhook: mã xác minh không khớp');
      throw new ForbiddenException('Mã xác minh không khớp');
    }
    res.status(200).type('text/plain').send(lay('challenge') ?? '');
  }

  @Public()
  @Post('facebook')
  @HttpCode(200)
  async nhan(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-hub-signature-256') chuKy: string | undefined) {
    const c = await this.fb.doc();
    if (!c.appSecret) throw new ServiceUnavailableException('Chưa cấu hình App Secret');
    if (!chuKyFacebookHopLe(chuKy, req.rawBody ?? Buffer.alloc(0), c.appSecret)) {
      this.log.warn(`Từ chối webhook Facebook: chữ ký không khớp (có header: ${!!chuKy}, độ dài nội dung: ${req.rawBody?.length ?? 0})`);
      throw new UnauthorizedException('Chữ ký không hợp lệ');
    }
    // Lỗi một sự kiện chỉ ghi log, vẫn trả 200: trả lỗi thì Meta gửi lại cả gói, tin đã lưu thì bị bỏ qua nhờ mã chống trùng.
    for (const e of phanTichFacebook(req.body)) {
      try {
        if (e.loai === 'trang') await this.tinTrang(e, c.appId);
        else await this.tinKhach(e);
      } catch (err) {
        this.log.warn(`Không xử lý được tin Facebook: ${(err as Error).message}`);
      }
    }
    return { ok: true };
  }

  /** Ảnh, sticker, PDF tải về lưu trong hệ thống; loại khác (hoặc tải lỗi) ghi dòng chữ kèm link gốc. Chữ kèm theo đi với tệp đầu tiên. */
  private async thanhTin(tep: DinhKemFb[], chu: string, ai: 'Khách' | 'Trang'): Promise<{ text: string; file?: TepDaLuu }[]> {
    if (!tep.length) return [{ text: chu }];
    const ra: { text: string; file?: TepDaLuu }[] = [];
    for (const [i, d] of tep.entries()) {
      const kem = i === 0 ? chu : '';
      const luu = /^(image|sticker|file)$/.test(d.loai) ? await this.fb.taiTep(d.url, d.ten) : null;
      if (luu) ra.push({ text: kem, file: luu });
      else ra.push({ text: `${kem ? `${kem} ` : ''}[${ai} gửi ${TEN_DINH_KEM[d.loai] ?? 'tệp'}${d.ten ? ` "${d.ten}"` : ''}: ${d.url}]`.slice(0, 4000) });
    }
    return ra;
  }

  /** Nhân viên trả lời ngay trên Meta Business Suite: ghi vào hội thoại. Tin do chính hệ thống này gửi (cùng App ID) thì bỏ, vì đã lưu lúc gửi. */
  private async tinTrang(e: Extract<SuKienFb, { loai: 'trang' }>, appId: string | undefined) {
    if (e.appId && appId && e.appId === appId) return;
    const cacTin = await this.thanhTin(e.tep, e.text, 'Trang');
    for (const [i, t] of cacTin.entries()) {
      await this.ingest.oaGui({ kenh: 'FACEBOOK', userId: e.psid, text: t.text, msgId: i ? `${e.mid}:${i}` : e.mid, file: t.file });
    }
  }

  private async tinKhach(e: Extract<SuKienFb, { loai: 'khach' }>) {
    const goc = e.traLoiMid ? await this.prisma.message.findUnique({ where: { externalMessageId: `fb:${e.traLoiMid}` }, select: { id: true } }) : null;
    const cacTin = await this.thanhTin(e.tep, e.text, 'Khách');

    // Tên và ảnh từ hồ sơ Messenger: khách mới, khách thiếu ảnh / chưa có tên, hoặc quay lại sau hơn 12 giờ (link ảnh có hạn).
    const dt = await this.prisma.customerIdentity.findUnique({
      where: { channel_externalId: { channel: 'FACEBOOK', externalId: e.psid } },
      select: { customer: { select: { id: true, name: true, avatarUrl: true, conversations: { where: { channel: 'FACEBOOK' }, select: { lastCustomerMessageAt: true }, take: 1 } } } },
    });
    const lanCuoi = dt?.customer.conversations[0]?.lastCustomerMessageAt;
    const thieu = !dt || !dt.customer.avatarUrl || dt.customer.name === TEN_CHUA_RO || !lanCuoi || Date.now() - lanCuoi.getTime() > 12 * 3600_000;
    const hoSo = thieu ? await this.fb.hoSoKhach(e.psid) : { ten: null, anh: null };

    let kq: Awaited<ReturnType<IngestService['inbound']>> | undefined;
    for (const [i, t] of cacTin.entries()) {
      const r = await this.ingest.inbound(
        { channel: 'FACEBOOK', externalUserId: e.psid, text: t.text, externalMessageId: `fb:${e.mid}${i ? `:${i}` : ''}`, ...(hoSo.ten && !dt && !i ? { customer: { name: hoSo.ten } } : {}) },
        t.file,
        goc && !i ? { replyToId: goc.id } : undefined,
      );
      kq ??= r;
    }
    if (!kq) return;
    if (hoSo.ten || hoSo.anh) {
      const id = dt?.customer.id ?? (await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel: 'FACEBOOK', externalId: e.psid } }, select: { customerId: true } }))?.customerId;
      const doiTen = !!hoSo.ten && !!dt && dt.customer.name === TEN_CHUA_RO;
      if (id && (hoSo.anh || doiTen)) await this.prisma.customer.update({ where: { id }, data: { ...(hoSo.anh ? { avatarUrl: hoSo.anh } : {}), ...(doiTen ? { name: hoSo.ten! } : {}) } });
    }
    // Messenger chưa có chatbot: chỉ gửi lại câu trả lời tự động hoặc câu báo đã chuyển nhân viên.
    if (!kq.duplicate && kq.reply && (kq.action === 'AUTO_REPLY' || kq.action === 'CONTACT')) {
      await this.fb.guiTin(e.psid, kq.reply).catch((err: Error) => this.log.warn(`Không gửi được câu trả lời tự động qua Messenger: ${err.message}`));
    }
  }
}
