import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../auth/auth.decorators';
import { kiemLinkAnh } from '../common/app-account';
import { StorageService } from '../storage/storage.service';
import { AppAccountService } from './app-account.service';
import { AppAuthGuard, AppUser, CurrentAppUser } from './app-auth.guard';
import { PageQuery } from './app-bookings.controller';
import { AppExtrasService } from './app-extras.service';
import { AppNotificationsService } from './app-notifications.service';

class AddFavoriteDto {
  @IsString() @MinLength(1) @MaxLength(100) tourKey: string;
  @IsString() @MinLength(1) @MaxLength(300) tourName: string;
  @IsOptional() @IsUrl({ protocols: ['https', 'http'], require_protocol: true }, { message: 'Link ảnh không hợp lệ' }) @MaxLength(1000) tourImage?: string;
  @IsOptional() @IsString() @MaxLength(60) durationText?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(100_000_000_000) unitPrice?: number;
  /** YYYY-MM-DD hoặc DD/MM/YYYY (website trả kiểu này); sai dạng thì bỏ qua, không báo lỗi. */
  @IsOptional() @IsString() @MaxLength(30) departureDate?: string;
}

class FeedbackDto {
  @IsString() @MinLength(1, { message: 'Vui lòng nhập chủ đề' }) @MaxLength(200) subject: string;
  @IsString() @MinLength(1, { message: 'Vui lòng nhập nội dung góp ý' }) @MaxLength(3000) content: string;
}

/** Gửi JSON `{ avatar: null }` để xoá ảnh (app cũ làm vậy). Tải ảnh thì gửi multipart trường `avatar`. */
class AvatarDto {
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() avatar?: null;
}

const DUOI_ANH: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/** Thông báo trong app (chưa có thông báo đẩy). */
@Public()
@UseGuards(AppAuthGuard)
@Controller('app/notifications')
export class AppNotificationsController {
  constructor(private svc: AppNotificationsService) {}

  @Get()
  list(@CurrentAppUser() me: AppUser, @Query() q: PageQuery) {
    return this.svc.danhSach(me.id, q.page ?? 1, q.limit ?? 20);
  }

  @Get('unread-count')
  unread(@CurrentAppUser() me: AppUser) {
    return this.svc.chuaDoc(me.id);
  }

  @Patch('read-all')
  readAll(@CurrentAppUser() me: AppUser) {
    return this.svc.docHet(me.id);
  }

  @Patch(':id/read')
  read(@CurrentAppUser() me: AppUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.doc(me.id, id);
  }
}

@Public()
@UseGuards(AppAuthGuard)
@Controller('app/favorites')
export class AppFavoritesController {
  constructor(private svc: AppExtrasService) {}

  @Get('me')
  mine(@CurrentAppUser() me: AppUser) {
    return this.svc.yeuThich(me);
  }

  @Post()
  add(@CurrentAppUser() me: AppUser, @Body() dto: AddFavoriteDto) {
    return this.svc.themYeuThich(me, dto);
  }

  @Get(':tourKey')
  check(@CurrentAppUser() me: AppUser, @Param('tourKey') tourKey: string) {
    return this.svc.coYeuThich(me, tourKey.slice(0, 100));
  }

  @Delete(':tourKey')
  remove(@CurrentAppUser() me: AppUser, @Param('tourKey') tourKey: string) {
    return this.svc.boYeuThich(me, tourKey.slice(0, 100));
  }
}

@Public()
@Controller('app')
export class AppMiscController {
  constructor(private svc: AppExtrasService, private accounts: AppAccountService, private storage: StorageService, private config: ConfigService) {}

  @UseGuards(AppAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('feedbacks')
  feedback(@CurrentAppUser() me: AppUser, @Body() dto: FeedbackDto) {
    return this.svc.gopY(me, dto.subject, dto.content);
  }

  /** Đổi hoặc xoá ảnh đại diện, trả hồ sơ mới như app cũ đọc. */
  @UseGuards(AppAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('users/me/avatar')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  async avatar(@CurrentAppUser() me: AppUser, @Body() dto: AvatarDto, @UploadedFile() file?: Express.Multer.File) {
    if (file) await this.svc.doiAnh(me, file);
    else if (dto.avatar === null) await this.svc.xoaAnh(me);
    else throw new BadRequestException('Chưa chọn ảnh');
    return this.accounts.hoSo(me.id);
  }

  /** Xem ảnh đại diện: công khai (thẻ ảnh của app không gửi token), bảo vệ bằng chữ ký có hạn. */
  @Get('avatar/:id')
  async xemAnh(@Param('id', ParseUUIDPipe) id: string, @Query('exp') exp: string | undefined, @Query('sig') sig: string | undefined, @Res() res: Response) {
    if (!kiemLinkAnh(this.config.getOrThrow<string>('JWT_SECRET'), id, exp, sig, Math.floor(Date.now() / 1000))) throw new NotFoundException('Link đã hết hạn hoặc không đúng');
    const path = await this.svc.duongDanAnh(id);
    if (this.storage.laODia) {
      const tep = await this.storage.tepODia(path);
      const loai = DUOI_ANH[path.split('.').pop()?.toLowerCase() ?? ''];
      if (!tep || !loai) throw new NotFoundException('Không có ảnh đại diện');
      res.set({ 'Content-Type': loai, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=86400' });
      return res.sendFile(tep.rel, { root: tep.root });
    }
    const url = await this.storage.linkTam(path, 60);
    if (!url) throw new NotFoundException('Không mở được ảnh, bạn thử lại sau nhé');
    return res.redirect(302, url);
  }
}
