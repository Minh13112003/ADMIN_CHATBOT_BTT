import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { Roles } from '../auth/auth.decorators';
import { Role } from '../generated/prisma/client';
import { MAX_STICKER_BYTES } from '../common/stickers';
import { StickersService } from './stickers.service';

class CreatePackDto {
  @IsString({ message: 'Tên tệp sticker không hợp lệ' }) @MaxLength(60, { message: 'Tên tệp sticker tối đa 60 ký tự' }) name: string;
}

class UpdatePackDto {
  @IsOptional() @IsString({ message: 'Tên tệp sticker không hợp lệ' }) @MaxLength(60, { message: 'Tên tệp sticker tối đa 60 ký tự' }) name?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

/** Tải lên là multipart nên `packId` đến dưới dạng chữ; chuỗi rỗng = không xếp vào tệp nào. */
class UploadDto {
  @IsOptional() @ValidateIf((_, v) => v !== '') @IsUUID('4', { message: 'Tệp sticker không hợp lệ' }) packId?: string;
}

class MoveDto {
  @ValidateIf((_, v) => v !== null) @IsUUID('4', { message: 'Tệp sticker không hợp lệ' }) packId: string | null;
}

@Controller('stickers')
export class StickersController {
  constructor(private svc: StickersService) {}

  @Get()
  list() { return this.svc.list(); }

  /** `all=1` (chỉ admin dùng ở trang Kho sticker) trả cả tệp đã ẩn. */
  @Get('packs')
  packs(@Query('all') all?: string) { return this.svc.packs(all === '1'); }

  @Post('packs')
  @Roles(Role.ADMIN)
  createPack(@Body() dto: CreatePackDto) { return this.svc.createPack(dto.name); }

  @Patch('packs/:id')
  @Roles(Role.ADMIN)
  updatePack(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePackDto) { return this.svc.updatePack(id, dto); }

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
  upload(@Body() dto: UploadDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn sticker');
    return this.svc.upload(file, dto.packId || undefined);
  }

  @Patch(':id/pack')
  @Roles(Role.ADMIN)
  move(@Param('id', ParseUUIDPipe) id: string, @Body() dto: MoveDto) { return this.svc.move(id, dto.packId); }

  @Patch(':id/hide')
  @Roles(Role.ADMIN)
  hide(@Param('id', ParseUUIDPipe) id: string) { return this.svc.hide(id); }
}
