import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AppAccountService } from './app-account.service';
import { AppAuthGuard } from './app-auth.guard';

const SECRET = 'x'.repeat(40);
const config = { getOrThrow: () => SECRET, get: () => SECRET } as never;

function dung(tk: Record<string, unknown> | null, soDon = 1, kh: { phone: string | null; appAccount: unknown } = { phone: '0914438603', appAccount: null }) {
  const luu: Record<string, unknown> = { ...(tk ?? {}) };
  const prisma = {
    appAccount: {
      findUnique: jest.fn(async () => (tk ? { ...luu, customer: { name: 'Nguyễn Văn An', avatarUrl: null, aliases: [] } } : null)),
      findUniqueOrThrow: jest.fn(async () => ({ ...luu, customerId: 'c1', customer: { name: 'Nguyễn Văn An', aliases: [] } })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(luu, data)),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => data),
    },
    conversation: { findUnique: jest.fn(async () => ({ customerId: 'c1', customer: { name: 'Nguyễn Văn An', ...kh } })) },
    deal: { count: jest.fn(async () => soDon) },
    message: { create: jest.fn(async ({ data }: { data: unknown }) => data) },
    customer: { update: jest.fn() },
    customerIdentity: { upsert: jest.fn() },
    $transaction: jest.fn(async (x: unknown[]) => Promise.all(x)),
  };
  const jwt = new JwtService({ secret: SECRET });
  const svc = new AppAccountService(prisma as never, jwt, config, { emit: jest.fn() } as never);
  return { svc, prisma, jwt, luu };
}

describe('AppAccountService', () => {
  it('đăng nhập đúng SĐT (nhập kiểu +84) và mật khẩu: trả token và hồ sơ theo tên trường app cũ', async () => {
    const { svc } = dung({ id: 'a1', phone: '0914438603', isActive: true, passwordHash: await bcrypt.hash('Ab3xyz', 4) });
    const r = await svc.dangNhap('+84 914 438 603', 'Ab3xyz');
    expect(r.accessToken).toBeTruthy();
    expect(r.refreshToken).toBeTruthy();
    expect(r.user).toMatchObject({ firstName: 'An', lastName: 'Nguyễn Văn', phonenumber: '0914438603', role: 'USER' });
  });

  it('sai mật khẩu hoặc số chưa có tài khoản: cùng một câu báo lỗi', async () => {
    const { svc } = dung({ id: 'a1', isActive: true, passwordHash: await bcrypt.hash('Ab3xyz', 4) });
    await expect(svc.dangNhap('0914438603', 'sai')).rejects.toThrow('Sai số điện thoại hoặc mật khẩu');
    const { svc: rong } = dung(null);
    await expect(rong.dangNhap('0914438603', 'Ab3xyz')).rejects.toThrow('Sai số điện thoại hoặc mật khẩu');
  });

  it('refresh token chỉ dùng được một lần; access token không dùng thay refresh token được', async () => {
    const { svc } = dung({ id: 'a1', phone: '0914438603', isActive: true, passwordHash: await bcrypt.hash('Ab3xyz', 4) });
    const { accessToken, refreshToken } = await svc.dangNhap('0914438603', 'Ab3xyz');
    const moi = await svc.lamMoi(`Bearer ${refreshToken}`);
    expect(moi.refreshToken).not.toBe(refreshToken);
    await expect(svc.lamMoi(`Bearer ${refreshToken}`)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.lamMoi(`Bearer ${accessToken}`)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('token app ký khoá riêng: khoá của nhân viên không đọc được', async () => {
    const { svc, jwt } = dung({ id: 'a1', phone: '0914438603', isActive: true, passwordHash: await bcrypt.hash('Ab3xyz', 4) });
    const { accessToken } = await svc.dangNhap('0914438603', 'Ab3xyz');
    await expect(jwt.verifyAsync(accessToken)).rejects.toBeTruthy();
  });

  it('guard từ chối tài khoản đã khoá', async () => {
    const { svc, jwt, prisma } = dung({ id: 'a1', phone: '0914438603', isActive: true, passwordHash: await bcrypt.hash('Ab3xyz', 4) });
    const { accessToken } = await svc.dangNhap('0914438603', 'Ab3xyz');
    prisma.appAccount.findUnique.mockResolvedValueOnce({ id: 'a1', customerId: 'c1', isActive: false } as never);
    const guard = new AppAuthGuard(jwt, config, prisma as never);
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sale tạo tài khoản: cần SĐT và đơn đã chốt; mật khẩu chỉ trả về, không ghi vào log', async () => {
    const sale = { id: 'u1', fullName: 'Thảo', role: 'SALE', departmentId: null, scopeIds: [] } as never;
    await expect(dung(null, 1, { phone: null, appAccount: null }).svc.taoHoacCapLai(sale, 'cv1')).rejects.toBeInstanceOf(BadRequestException);
    await expect(dung(null, 0).svc.taoHoacCapLai(sale, 'cv1')).rejects.toBeInstanceOf(BadRequestException);
    const { svc, prisma } = dung(null, 1);
    const r = await svc.taoHoacCapLai(sale, 'cv1');
    expect(r).toMatchObject({ phone: '0914438603', created: true });
    expect(r.password).toMatch(/^[A-Za-z2-9]{6}$/);
    const log = (prisma.message.create.mock.calls[0] as [{ data: { text: string; internal: boolean } }])[0].data;
    expect(log.internal).toBe(true);
    expect(log.text).not.toContain(r.password);
  });
});
