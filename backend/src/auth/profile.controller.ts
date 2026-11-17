import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from '../storage/attachments.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser, CurrentUser, Roles } from './auth.decorators';

class ProfileDto {
  @IsString() @MinLength(2, { message: 'Họ tên cần ít nhất 2 ký tự' }) @MaxLength(100, { message: 'Họ tên tối đa 100 ký tự' }) fullName: string;
}

const DUOI_ANH: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };

/** Link ảnh đại diện nhân viên (đường dẫn tương đối, cần cookie). `v` đổi khi đổi ảnh để trình duyệt không giữ ảnh cũ. */
export const linkAnhNhanVien = (id: string, avatarPath: string | null) => (avatarPath ? `/users/${id}/avatar?v=${encodeURIComponent(avatarPath.split('/').pop()?.split('.')[0]?.slice(0, 12) ?? '1')}` : null);

/**
 * Trang cá nhân (2026-11-17): nhân viên tự đổi họ tên và ảnh đại diện. Mã nhân viên, chức vụ, phòng ban chỉ admin sửa ở trang Quản trị tài khoản.
 * Đổi mật khẩu dùng `POST /auth/change-password` có sẵn.
 */
@Roles(Role.ADMIN, Role.SALE, Role.DEPT_ADMIN, Role.DIGITAL)
@Controller()
export class ProfileController {
  constructor(private prisma: PrismaService, private tep: AttachmentsService, private storage: StorageService) {}

  @Patch('auth/me')
  async doiTen(@CurrentUser() me: AuthUser, @Body() dto: ProfileDto) {
    const fullName = dto.fullName.trim().replace(/\s+/g, ' ');
    if (fullName.length < 2) throw new BadRequestException('Họ tên cần ít nhất 2 ký tự');
    await this.prisma.user.update({ where: { id: me.id }, data: { fullName } });
    return { fullName };
  }

  /** Chỉ nhận ảnh (kiểm tra theo nội dung, thu nhỏ, bỏ EXIF); ảnh cũ bị xoá. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('auth/me/avatar')
  @UseInterceptors(FileInterceptor('avatar', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  async doiAnh(@CurrentUser() me: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn ảnh');
    const cb = await this.tep.chuanBi(file);
    if (!cb.anh) throw new BadRequestException('Ảnh đại diện phải là ảnh JPG, PNG hoặc WebP');
    const luu = await this.tep.luuDaChuanBi(cb);
    const cu = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { avatarPath: true } });
    await this.prisma.user.update({ where: { id: me.id }, data: { avatarPath: luu.path } });
    if (cu.avatarPath) await this.tep.xoaTep(cu.avatarPath);
    return { avatarUrl: linkAnhNhanVien(me.id, luu.path) };
  }

  @Delete('auth/me/avatar')
  async xoaAnh(@CurrentUser() me: AuthUser) {
    const cu = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { avatarPath: true } });
    if (cu.avatarPath) {
      await this.prisma.user.update({ where: { id: me.id }, data: { avatarPath: null } });
      await this.tep.xoaTep(cu.avatarPath);
    }
    return { avatarUrl: null };
  }

  /** Xem ảnh đại diện của một nhân viên (cần đăng nhập trang quản trị). */
  @Get('users/:id/avatar')
  async xemAnh(@Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { avatarPath: true } });
    if (!u?.avatarPath) throw new NotFoundException('Không có ảnh đại diện');
    if (this.storage.laODia) {
      const tep = await this.storage.tepODia(u.avatarPath);
      const loai = DUOI_ANH[u.avatarPath.split('.').pop()?.toLowerCase() ?? ''];
      if (!tep || !loai) throw new NotFoundException('Không có ảnh đại diện');
      res.set({ 'Content-Type': loai, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=86400' });
      return res.sendFile(tep.rel, { root: tep.root });
    }
    const url = await this.storage.linkTam(u.avatarPath, 60);
    if (!url) throw new NotFoundException('Không mở được ảnh, bạn thử lại sau nhé');
    return res.redirect(302, url);
  }
}
