import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators';
import { kiemLinkTep } from '../common/attachments';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

/**
 * Xem file đính kèm. Công khai (không cần cookie) vì app, web, Mini App của khách không có phiên đăng nhập của trang quản trị;
 * bảo vệ bằng chữ ký có hạn gắn với đúng một tin. Tin nội bộ (`internal`) không bao giờ có link.
 * Lưu trên ổ đĩa: backend phát file trực tiếp. Lưu ở Supabase: chuyển hướng tới link ký sống 60 giây.
 */
@Public()
@Controller('files')
export class FilesController {
  constructor(private prisma: PrismaService, private storage: StorageService, private config: ConfigService) {}

  @Get(':id')
  async xem(@Param('id', ParseUUIDPipe) id: string, @Query('exp') exp: string | undefined, @Query('sig') sig: string | undefined, @Res() res: Response) {
    if (!kiemLinkTep(this.config.getOrThrow<string>('JWT_SECRET'), id, exp, sig, Math.floor(Date.now() / 1000))) throw new NotFoundException('Link đã hết hạn hoặc không đúng');
    const m = await this.prisma.message.findFirst({ where: { id, internal: false, attachmentPath: { not: null } }, select: { attachmentPath: true, attachmentType: true, attachmentName: true } });
    if (!m?.attachmentPath) throw new NotFoundException('Không tìm thấy file');

    if (this.storage.laODia) {
      const tep = await this.storage.tepODia(m.attachmentPath);
      if (!tep || !m.attachmentType) throw new NotFoundException('Không tìm thấy file');
      // Loại file lấy từ database (đã nhận ra theo nội dung lúc tải lên), không đoán theo đuôi; nosniff chặn trình duyệt tự đoán lại.
      res.set({
        'Content-Type': m.attachmentType,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': "inline; filename*=UTF-8''" + encodeURIComponent(m.attachmentName ?? 'tep'),
        'Cache-Control': 'private, max-age=3600',
      });
      return res.sendFile(tep.rel, { root: tep.root });
    }

    const url = await this.storage.linkTam(m.attachmentPath, 60);
    if (!url) throw new NotFoundException('Không mở được file, bạn thử lại sau ít phút nhé');
    return res.redirect(302, url);
  }
}
