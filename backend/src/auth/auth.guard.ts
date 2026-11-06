import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { COOKIE_NAME, IS_PUBLIC, ROLES } from './auth.decorators';

/** Mọi route đều cần đăng nhập, trừ route gắn @Public. Quyền theo @Roles; mặc định SALE và ADMIN (admin dùng giao diện như sale); thống kê và tài khoản chỉ ADMIN. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw new UnauthorizedException('Bạn chưa đăng nhập');

    let sub: string;
    try {
      sub = (await this.jwt.verifyAsync<{ sub: string }>(token)).sub;
    } catch {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
    }
    const user = await this.prisma.user.findUnique({ where: { id: sub }, select: { id: true, role: true, fullName: true, isActive: true } });
    if (!user?.isActive) throw new UnauthorizedException('Tài khoản không còn hoạt động');
    req.user = user;

    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets) ?? [Role.SALE, Role.ADMIN];
    if (!roles.includes(user.role)) throw new ForbiddenException('Tài khoản của bạn không có quyền này');
    return true;
  }
}
