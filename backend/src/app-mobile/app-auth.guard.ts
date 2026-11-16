import { CanActivate, createParamDecorator, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/** Khách đang đăng nhập app (đọc từ access token). */
export type AppUser = { id: string; customerId: string };
export const CurrentAppUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AppUser => ctx.switchToHttp().getRequest().appUser);

type Loai = 'access' | 'refresh';
export type AppTokenPayload = { sub: string; typ: Loai; jti?: string };

/**
 * Khoá ký token app tách khỏi khoá của nhân viên: token khách không bao giờ qua được AuthGuard của trang quản trị
 * (và ngược lại), kể cả khi bị đặt vào cookie.
 */
export function khoaApp(config: ConfigService): string {
  return `${config.getOrThrow<string>('JWT_SECRET')}:app-mobile`;
}

/** Đọc token Bearer và kiểm tra đúng loại (access/refresh). Sai thì ném 401 với câu tiếng Việt. */
export async function docTokenApp(jwt: JwtService, config: ConfigService, header: string | undefined, loai: Loai): Promise<AppTokenPayload> {
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new UnauthorizedException('Bạn chưa đăng nhập');
  let p: AppTokenPayload;
  try {
    p = await jwt.verifyAsync<AppTokenPayload>(token, { secret: khoaApp(config) });
  } catch {
    throw new UnauthorizedException('Phiên đăng nhập đã hết hạn');
  }
  if (p.typ !== loai) throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
  return p;
}

/**
 * Bảo vệ API của app Mobile. Các controller app gắn @Public() để bỏ qua AuthGuard (cookie nhân viên) rồi dùng guard này.
 * Tài khoản bị khoá thì token cũ hết dùng ngay.
 */
@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private config: ConfigService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const p = await docTokenApp(this.jwt, this.config, req.headers?.authorization, 'access');
    const tk = await this.prisma.appAccount.findUnique({ where: { id: p.sub }, select: { id: true, customerId: true, isActive: true } });
    if (!tk?.isActive) throw new UnauthorizedException('Tài khoản không còn hoạt động');
    req.appUser = { id: tk.id, customerId: tk.customerId } satisfies AppUser;
    return true;
  }
}
