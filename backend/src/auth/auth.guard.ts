import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { cauHinhPhien, nenGiaHan } from '../common/session';
import { COOKIE_NAME, IS_PUBLIC, ROLES } from './auth.decorators';
import { capPhien } from './session';

/** Mọi route đều cần đăng nhập, trừ route gắn @Public. Quyền theo @Roles; mặc định SALE và ADMIN (admin dùng giao diện như sale); thống kê và tài khoản chỉ ADMIN. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private prisma: PrismaService, private config: ConfigService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Bạn chưa đăng nhập');

    let payload: { sub: string; iat?: number; auth?: number };
    try {
      payload = await this.jwt.verifyAsync<{ sub: string; iat?: number; auth?: number }>(token);
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, fullName: true, isActive: true, departmentId: true, scopeIds: true } });
    if (!user?.isActive) throw new UnauthorizedException('Tài khoản không còn hoạt động');
    req.user = user;

    // Phiên trượt: đang dùng thì gia hạn cookie, để sang ngày mới không bị đăng xuất.
    if (nenGiaHan(payload, Math.floor(Date.now() / 1000), cauHinhPhien(this.config.get('SESSION_DAYS'), this.config.get('SESSION_MAX_DAYS')))) {
      await capPhien(this.jwt, this.config, ctx.switchToHttp().getResponse(), user.id, payload.auth ?? payload.iat!);
    }

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets) ?? [Role.SALE, Role.ADMIN, Role.DEPT_ADMIN];
    if (!roles.includes(user.role)) throw new ForbiddenException('Tài khoản của bạn không có quyền này');
    return true;
  }
}
