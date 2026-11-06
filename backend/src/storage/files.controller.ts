import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Query, Redirect } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/auth.decorators';
import { kiemLinkTep } from '../common/attachments';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

/**
 * Xem file đính kèm. Công khai (không cần cookie) vì app, web, Mini App của khách không có phiên đăng nhập của trang quản trị;
 * bảo vệ bằng chữ ký có hạn gắn với đúng một tin. Tin nội bộ (`internal`) không bao giờ có link.
 */
@Public()
@Controller('files')
export class FilesController {
  constructor(private prisma: PrismaService, private storage: StorageService, private config: ConfigService) {}

  @Get(':id')
  @Redirect()
  async xem(@Param('id', ParseUUIDPipe) id: string, @Query('exp') exp?: string, @Query('sig') sig?: string) {
    if (!kiemLinkTep(this.config.getOrThrow<string>('JWT_SECRET'), id, exp, sig, Math.floor(Date.now() / 1000))) throw new NotFoundException('Link đã hết hạn hoặc không đúng');
    const m = await this.prisma.message.findFirst({ where: { id, internal: false, attachmentPath: { not: null } }, select: { attachmentPath: true } });
    if (!m?.attachmentPath) throw new NotFoundException('Không tìm thấy file');
    const url = await this.storage.linkTam(m.attachmentPath, 60);
    if (!url) throw new NotFoundException('Không mở được file, bạn thử lại sau ít phút nhé');
    return { url, statusCode: 302 };
  }
}
