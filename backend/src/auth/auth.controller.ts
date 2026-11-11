import { Body, Controller, Get, HttpCode, Post, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Throttle } from '@nestjs/throttler';
import { Role } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser, COOKIE_NAME, CurrentUser, Public, Roles } from './auth.decorators';
import { capPhien } from './session';

class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' }) email: string;
  @IsString() @MinLength(1) @MaxLength(200) password: string;
}

class ChangePasswordDto {
  @IsString() @MaxLength(200) currentPassword: string;
  @IsString() @MinLength(8, { message: 'Mật khẩu mới cần ít nhất 8 ký tự' }) @MaxLength(200) newPassword: string;
}

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const ok = user?.isActive && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException('Sai email hoặc mật khẩu');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await capPhien(this.jwt, this.config, res, user.id, Math.floor(Date.now() / 1000));
    return { id: user.id, role: user.role, fullName: user.fullName };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/', domain: this.config.get('COOKIE_DOMAIN') || undefined });
  }

  @Roles(Role.ADMIN, Role.SALE, Role.DEPT_ADMIN, Role.DIGITAL)
  @Get('me')
  async me(@CurrentUser() me: AuthUser) {
    const [u, load] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: me.id },
        select: { id: true, email: true, fullName: true, role: true, employeeCode: true, position: true, onDuty: true, departmentId: true, department: { select: { name: true } }, scopeIds: true },
      }),
      this.prisma.conversation.count({ where: { assigneeId: me.id, status: { in: ['CONTACT', 'PENDING'] } } }),
    ]);
    return { ...u, load };
  }

  @Roles(Role.ADMIN, Role.SALE, Role.DEPT_ADMIN, Role.DIGITAL)
  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentUser() me: AuthUser, @Body() dto: ChangePasswordDto) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash))) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    await this.prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) } });
  }
}
