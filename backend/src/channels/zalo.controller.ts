import { Controller, Get, Headers, HttpCode, Logger, Post, Query, Req, Res, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public, Roles } from '../auth/auth.decorators';
import { chuKyHopLe, layDinhKem, layTrich, phanTichChiaSe, phanTichOa, phanTichPhanUng, phanTichSuKien, thuCongThuc, truongLa, type DinhKemZalo } from '../common/zalo';
import type { TepDaLuu } from '../storage/attachments.service';
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

  @Roles(Role.ADMIN)
  @Get('status')
  trangThai() {
    return this.zalo.trangThai();
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
const TEN_DINH_KEM: Record<string, string> = { image: 'ảnh', photo: 'ảnh', file: 'tệp', sticker: 'sticker', gif: 'ảnh động', video: 'video', audio: 'tin thoại', link: 'liên kết' };

/** Zalo gửi tin của khách về đây. */
@Controller('webhooks')
export class ZaloWebhookController {
  private log = new Logger('ZaloWebhook');
  constructor(private zalo: ZaloService, private ingest: IngestService, private prisma: PrismaService, private sync: ZaloSyncService) {}

  /**
   * Đổi tệp đính kèm Zalo thành các tin để ghi: ảnh/PDF tải về lưu trong hệ thống để xem ngay trong khung chat;
   * loại khác (hoặc tải lỗi) ghi dòng chữ kèm link gốc của Zalo. `caption` (chữ kèm theo) đi với tệp đầu tiên.
   */
  private async dinhKemThanhTin(dk: DinhKemZalo[], caption: string, ai: 'Khách' | 'OA'): Promise<{ text: string; file?: TepDaLuu }[]> {
    const ra: { text: string; file?: TepDaLuu }[] = [];
    for (const [i, d] of dk.entries()) {
      const chu = i === 0 ? caption : '';
      const duocLuu = /^(image|photo|sticker|gif|file)$/i.test(d.loai) ? await this.zalo.taiTep(d.url, d.ten) : null;
      if (duocLuu) ra.push({ text: chu, file: duocLuu });
      else ra.push({ text: `${chu ? `${chu} ` : ''}[${ai} gửi ${TEN_DINH_KEM[d.loai] ?? 'tệp'}${d.ten ? ` "${d.ten}"` : ''}: ${d.url}]`.slice(0, 4000) });
    }
    return ra;
  }

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
    // Nhân viên trả lời ngay trên ứng dụng Zalo OA: ghi vào hội thoại (không gửi lại, không trả lời tự động).
    const oa = phanTichOa(body);
    if (oa) {
      try {
        const dk = layDinhKem(body);
        // Chẩn đoán: tên sự kiện, tên trường, số tệp đọc được (không ghi nội dung, không ghi link).
        const mm = (body?.message ?? {}) as Record<string, unknown>;
        const pl = Array.isArray(mm.attachments) ? (mm.attachments as Record<string, unknown>[])[0] : undefined;
        this.log.log(`Tin OA gửi: ${oa.tenSuKien}; trường message: ${Object.keys(mm).join(',') || '-'}; tệp đọc được: ${dk.length}${pl ? `; loại tệp đầu: ${String(pl.type)}; trường payload: ${Object.keys((pl.payload ?? {}) as object).join(',')}` : ''}`);
        const cacTin = dk.length ? await this.dinhKemThanhTin(dk, oa.text.startsWith('[OA gửi') ? '' : oa.text, 'OA') : [{ text: oa.text }];
        const trichOa = layTrich(body).msgId;
        if (truongLa(body).length) this.log.log(`Tin OA gửi có trường lạ trong message: ${truongLa(body).join(',')}`);
        for (const [i, t] of cacTin.entries()) await this.ingest.oaGui({ userId: oa.userId, text: t.text, msgId: oa.msgId ? (i ? `${oa.msgId}:${i}` : oa.msgId) : null, file: t.file, ...(trichOa && !i ? { trichMa: trichOa } : {}) });
      } catch (err) {
        this.log.warn(`Không ghi được tin OA gửi: ${(err as Error).message}`);
      }
      return { ok: true };
    }
    const chiaSe = phanTichChiaSe(body);
    if (chiaSe) {
      await this.ingest.khachChiaSeThongTin(chiaSe).catch((err: Error) => this.log.warn(`Không lưu được thông tin khách chia sẻ: ${err.message}`));
      return { ok: true };
    }
    const pu = phanTichPhanUng(body);
    if (pu) {
      await this.ingest.khachThaCamXuc(pu).catch((err: Error) => this.log.warn(`Không ghi được cảm xúc của khách: ${err.message}`));
      return { ok: true };
    }
    const e = phanTichSuKien(body);
    if (!e) {
      // Chẩn đoán: ghi tên sự kiện và tên trường (không ghi nội dung) để biết Zalo còn gửi loại nào mà mình chưa xử lý.
      this.log.log(`Bỏ qua sự kiện Zalo: ${String(thu.event_name)}; trường: ${Object.keys(thu).join(',')}; trường message: ${Object.keys(m).join(',') || '-'}`);
      return { ok: true, ignored: true };
    }
    const dinhKem = layDinhKem(body);
    const trich = layTrich(body);
    // Chẩn đoán: Zalo gửi thêm trường nào (ví dụ thông tin trích dẫn) mà mình chưa đọc. Chỉ ghi tên trường.
    if (truongLa(body).length) this.log.log(`Tin khách Zalo có trường lạ trong message: ${truongLa(body).join(',')}; đọc được trích dẫn: ${trich.msgId || trich.text ? 'có' : 'không'}`);
    const goc2 = trich.msgId ? await this.prisma.message.findUnique({ where: { externalMessageId: `zalo:${trich.msgId}` }, select: { id: true } }) : null;
    const tienTo = !goc2 && trich.text ? `[Trả lời: "${trich.text}"] ` : '';
    const cacTin = !e.laText && dinhKem.length ? await this.dinhKemThanhTin(dinhKem, typeof m.text === 'string' ? m.text.trim() : '', 'Khách') : [{ text: e.text }];
    cacTin[0] = { ...cacTin[0], text: `${tienTo}${cacTin[0].text}`.trim() };

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
    let kq: Awaited<ReturnType<IngestService['inbound']>> | undefined;
    for (const [i, t] of cacTin.entries()) {
      const r = await this.ingest.inbound(
        { channel: 'ZALO', externalUserId: e.userId, text: t.text, externalMessageId: e.msgId ? `zalo:${e.msgId}${i ? `:${i}` : ''}` : undefined, ...(hoSo.ten && !dt && !i ? { customer: { name: hoSo.ten } } : {}) },
        t.file,
        goc2 && !i ? { replyToId: goc2.id } : undefined,
      );
      kq ??= r;
    }
    if (!kq) return { ok: true };
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
