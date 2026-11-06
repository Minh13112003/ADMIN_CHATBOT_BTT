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

class LoginDto {
  @IsEmail({}, { message: 'Email không hợp lệ' }) email: string;
  @IsString() @MinLength(1) @MaxLength(200) password: string;
}

class ChangePasswordDto {
  @IsString() @MaxLength(200) currentPassword: string;
  @IsString() @MinLength(8, { message: 'Mật khẩu mới cần ít nhất 8 ký tự' }) @MaxLength(200) newPassword: string;
}

const HOURS = 12;

@Controller('auth')
export class AuthController {
  constructor(private prisma: PrismaService, private jwt: JwtService, private config: ConfigService) {}

  private datCookie(res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('NODE_ENV') === 'production',
      domain: this.config.get('COOKIE_DOMAIN') || undefined,
      maxAge: HOURS * 3600_000,
      path: '/',
    });
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    const ok = user?.isActive && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) throw new UnauthorizedException('Sai email hoặc mật khẩu');
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    this.datCookie(res, await this.jwt.signAsync({ sub: user.id }, { expiresIn: `${HOURS}h` }));
    return { id: user.id, role: user.role, fullName: user.fullName };
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/', domain: this.config.get('COOKIE_DOMAIN') || undefined });
  }

  @Roles(Role.ADMIN, Role.SALE)
  @Get('me')
  async me(@CurrentUser() me: AuthUser) {
    const [u, load] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: me.id },
        select: { id: true, email: true, fullName: true, role: true, employeeCode: true, position: true, onDuty: true },
      }),
      this.prisma.conversation.count({ where: { assigneeId: me.id, status: { in: ['CONTACT', 'PENDING'] } } }),
    ]);
    return { ...u, load };
  }

  @Roles(Role.ADMIN, Role.SALE)
  @Post('change-password')
  @HttpCode(204)
  async changePassword(@CurrentUser() me: AuthUser, @Body() dto: ChangePasswordDto) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await bcrypt.compare(dto.currentPassword, u.passwordHash))) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    await this.prisma.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) } });
  }
}
