import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { Response } from 'express';
import { cauHinhPhien, hanToken } from '../common/session';
import { COOKIE_NAME } from './auth.decorators';

/** Ký token mới và đặt cookie. `auth` là giây lúc đăng nhập bằng mật khẩu, giữ nguyên khi gia hạn. */
export async function capPhien(jwt: JwtService, config: ConfigService, res: Response, sub: string, auth: number) {
  const now = Math.floor(Date.now() / 1000);
  const han = hanToken(auth, now, cauHinhPhien(config.get('SESSION_DAYS'), config.get('SESSION_MAX_DAYS')));
  const token = await jwt.signAsync({ sub, auth }, { expiresIn: han });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.get('NODE_ENV') === 'production',
    domain: config.get('COOKIE_DOMAIN') || undefined,
    maxAge: han * 1000,
    path: '/',
  });
}
