import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Roles } from '../auth/auth.decorators';
import { Role } from '../generated/prisma/client';
import { MAX_STICKER_BYTES } from '../common/stickers';
import { StickersService } from './stickers.service';

@Controller('stickers')
export class StickersController {
  constructor(private svc: StickersService) {}

  @Get()
  list() { return this.svc.list(); }

  @Get(':id/image')
  async image(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const data = await this.svc.image(id);
    res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' });
    res.send(data);
  }

  @Post()
  @Roles(Role.ADMIN)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_STICKER_BYTES, files: 1 } }))
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn sticker');
    return this.svc.upload(file);
  }

  @Patch(':id/hide')
  @Roles(Role.ADMIN)
  hide(@Param('id', ParseUUIDPipe) id: string) { return this.svc.hide(id); }
}
