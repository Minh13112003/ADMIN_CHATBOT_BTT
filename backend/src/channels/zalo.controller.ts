import { Controller, Get, Headers, HttpCode, Logger, Post, Query, Req, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public, Roles } from '../auth/auth.decorators';
import { chuKyHopLe, phanTichSuKien, thuCongThuc } from '../common/zalo';
import { Role } from '../generated/prisma/client';
import { IngestService } from '../ingest/ingest.service';
import { PrismaService } from '../prisma/prisma.service';
import { ZaloService } from './zalo.service';
import { ZaloSyncService } from './zalo-sync.service';

/** Kết nối Zalo bằng OAuth: link cấp quyền (chỉ ADMIN) và địa chỉ Zalo quay về. */
@Controller('channel-settings/zalo')
export class ZaloOAuthController {
  constructor(private zalo: ZaloService) {}

  @Roles(Role.ADMIN)
  @Get('connect-url')
  async link() {
    return { url: await this.zalo.taoLinkCapQuyen() };
  }

  /** Công khai vì Zalo chuyển trình duyệt về đây; an toàn nhờ `state` dùng một lần, hết hạn sau 10 phút. */
  @Public()
  @Get('callback')
  async quayVe(@Query('code') code: string | undefined, @Query('state') state: string | undefined, @Query('oa_id') oaId: string | undefined, @Res() res: Response) {
    const ve = (kq: 'ok' | 'loi', ly = '') => res.redirect(`${this.zalo.goc()}/channels?zalo=${kq}${ly ? `&ly=${encodeURIComponent(ly)}` : ''}`);
    if (!code || !state) return ve('loi', 'Zalo không gửi kèm mã cấp quyền');
    try {
      await this.zalo.doiMaLayToken(code, state, oaId);
      return ve('ok');
    } catch (e) {
      return ve('loi', (e as Error).message);
    }
  }
}

const TEN_CHUA_RO = 'Khách chưa rõ tên';

/** Zalo gửi tin của khách về đây. */
@Controller('webhooks')
export class ZaloWebhookController {
  private log = new Logger('ZaloWebhook');
  constructor(private zalo: ZaloService, private ingest: IngestService, private prisma: PrismaService, private sync: ZaloSyncService) {}

  @Public()
  @Post('zalo')
  @HttpCode(200)
  async nhan(@Req() req: Request & { rawBody?: Buffer }, @Headers('x-zevent-signature') chuKy: string | undefined, @Headers('mac') macCu: string | undefined) {
    // Zalo gửi một yêu cầu thử không mang sự kiện khi bấm "Kiểm tra" ở trang ứng dụng và chỉ chấp nhận 200. Không có gì để lưu nên trả 200.
    const thu = req.body as Record<string, unknown> | undefined;
    if (!thu || typeof thu.event_name !== 'string') return { ok: true, ping: true };
    // Tin mẫu cố định Zalo gửi khi bấm "Kiểm tra" (chữ ký của nó dùng khoá mà trang Webhook chỉ hiện sau khi lưu được URL).
    // Trả 200 để lưu được URL; không lưu gì nên giả mạo tin mẫu này cũng vô hại. Tin thật vẫn bắt buộc đúng chữ ký.
    const m = (thu.message ?? {}) as Record<string, unknown>;
    if (thu.event_name === 'user_send_text' && m.text === 'This is testing message') return { ok: true, test: true };
    const c = await this.zalo.doc();
    // Khoá ký: OA Secret Key nếu có; không có thì thử khoá bí mật của ứng dụng (chưa chắc Zalo ký bằng khoá nào, nên thử cả hai).
    const khoaKy = [c.oaSecretKey, c.appSecret].filter((k): k is string => !!k);
    if (!c.appId || !khoaKy.length) throw new ServiceUnavailableException('Chưa cấu hình App ID và khoá bí mật');
    const goc = req.rawBody?.toString('utf8') ?? '';
    const body = req.body as Record<string, unknown> | undefined;
    const timestamp = body?.timestamp === undefined ? '' : String(body.timestamp);
    if (!khoaKy.some((k) => chuKyHopLe(chuKy ?? macCu, c.appId, goc, timestamp, k))) {
      // Chẩn đoán: ghi lại Zalo gửi gì (chữ ký là mã băm, không lộ khoá) để đối chiếu công thức ký.
      this.log.warn(`Từ chối webhook: chữ ký không khớp. ${JSON.stringify({ tenHeader: Object.keys(req.headers ?? {}).filter((h) => /sig|mac|zevent|zalo|x-/i.test(h)), chuKyNhan: chuKy ?? macCu ?? null, timestamp, doDaiNoiDung: goc.length, noiDung: goc.slice(0, 600), coOaSecret: !!c.oaSecretKey, coAppSecret: !!c.appSecret, congThucKhop: thuCongThuc(chuKy ?? macCu, c.appId, goc, timestamp, { appSecret: c.appSecret ?? '', oaSecretKey: c.oaSecretKey ?? '', appId: c.appId, oaId: c.oaId ?? '', accessToken: c.accessToken ?? '', refreshToken: c.refreshToken ?? '' }) })}`);
      throw new UnauthorizedException('Chữ ký không hợp lệ');
    }
    const e = phanTichSuKien(body);
    if (!e) return { ok: true, ignored: true };

    // Lấy tên và ảnh đại diện từ hồ sơ Zalo khi là khách mới, hoặc khách cũ còn thiếu ảnh / chưa có tên thật.
    const dt = await this.prisma.customerIdentity.findUnique({
      where: { channel_externalId: { channel: 'ZALO', externalId: e.userId } },
      select: { customer: { select: { id: true, name: true, avatarUrl: true, conversations: { where: { channel: 'ZALO' }, select: { lastCustomerMessageAt: true }, take: 1 } } } },
    });
    // Link ảnh Zalo có thể hết hạn: khách quay lại sau hơn 12 giờ thì lấy lại ảnh.
    const lanCuoi = dt?.customer.conversations[0]?.lastCustomerMessageAt;
    const lauRoi = !lanCuoi || Date.now() - lanCuoi.getTime() > 12 * 3600_000;
    const thieu = !dt || !dt.customer.avatarUrl || dt.customer.name === TEN_CHUA_RO || lauRoi;
    const hoSo = thieu ? await this.zalo.hoSoKhach(e.userId) : { ten: null, anh: null };
    const kq = await this.ingest.inbound({ channel: 'ZALO', externalUserId: e.userId, text: e.text, externalMessageId: e.msgId ? `zalo:${e.msgId}` : undefined, ...(hoSo.ten && !dt ? { customer: { name: hoSo.ten } } : {}) });
    if (dt && (hoSo.ten || hoSo.anh)) {
      await this.prisma.customer.update({
        where: { id: dt.customer.id },
        data: { ...(hoSo.anh ? { avatarUrl: hoSo.anh } : {}), ...(hoSo.ten && dt.customer.name === TEN_CHUA_RO ? { name: hoSo.ten } : {}) },
      });
    } else if (!dt && hoSo.anh) {
      const moi = await this.prisma.customerIdentity.findUnique({ where: { channel_externalId: { channel: 'ZALO', externalId: e.userId } }, select: { customerId: true } });
      if (moi) await this.prisma.customer.update({ where: { id: moi.customerId }, data: { avatarUrl: hoSo.anh } });
    }
    // Khách mới: kéo luôn tin cũ về (chạy nền, lỗi chỉ ghi log để không làm chậm phản hồi cho Zalo).
    if (!dt) void this.sync.dongBo(kq.conversationId).catch((err: Error) => this.log.warn(`Không kéo được tin cũ của khách Zalo mới: ${err.message}`));
    // Zalo chưa có chatbot: chỉ gửi lại câu trả lời tự động hoặc câu báo đã chuyển nhân viên.
    if (!kq.duplicate && kq.reply && (kq.action === 'AUTO_REPLY' || kq.action === 'CONTACT')) {
      try {
        await this.zalo.guiTin(e.userId, kq.reply);
      } catch (err) {
        this.log.warn(`Không gửi được câu trả lời tự động qua Zalo: ${(err as Error).message}`);
      }
    }
    return { ok: true };
  }
}
