import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { from, mergeMap, type Observable } from 'rxjs';
import { Role } from '../generated/prisma/client';
import { moTaThaoTac } from '../common/activity';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService, type NguoiLam } from './activity.service';

const GHI = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Ghi nhật ký sau mỗi yêu cầu ghi dữ liệu THÀNH CÔNG của nhân viên (đã đăng nhập). Yêu cầu lỗi không ghi.
 * Tên khách / tên đối tượng đọc TRƯỚC khi chạy route, vì route xoá xong thì không đọc lại được.
 * Việc ghi chạy sau khi đã có kết quả nhưng không chờ, để không làm chậm thao tác.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private activity: ActivityService, private prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const method = String(req.method ?? '').toUpperCase();
    const path: string = req.route?.path ?? '';
    if (!GHI.has(method) || !path) return next.handle();
    const laDangNhap = /\/auth\/login$/.test(path);
    if (!req.user && !laDangNhap) return next.handle();
    const params = (req.params ?? {}) as Record<string, string>;
    const tenTruoc = this.docTen(path.replace(/^\/api\/v1/, ''), params.id);
    return from(tenTruoc).pipe(
      mergeMap((ten) =>
        next.handle().pipe(
          mergeMap(async (ketQua) => {
            const nguoi: NguoiLam | null = laDangNhap ? this.tuKetQua(ketQua) : req.user;
            const muc = nguoi ? moTaThaoTac({ method, path, params, body: req.body, ketQua, khach: ten.khach, doiTuong: ten.doiTuong }) : null;
            if (nguoi && muc) void this.activity.ghi(nguoi, muc, req.ip);
            return ketQua;
          }),
        ),
      ),
    );
  }

  private tuKetQua(kq: unknown): NguoiLam | null {
    const k = kq as { id?: unknown; fullName?: unknown; role?: unknown } | null;
    return k && typeof k.id === 'string' && typeof k.fullName === 'string' ? { id: k.id, fullName: k.fullName, role: k.role as Role } : null;
  }

  /** Lỗi đọc tên không được làm hỏng thao tác chính. */
  private async docTen(p: string, id?: string): Promise<{ khach?: string | null; doiTuong?: string | null }> {
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return {};
    try {
      if (p.startsWith('/conversations/:id') || p.startsWith('/trash/conversations/:id')) {
        const c = await this.prisma.conversation.findUnique({ where: { id }, select: { customer: { select: { name: true } } } });
        return { khach: c?.customer.name ?? null };
      }
      if (p.startsWith('/vouchers/:id')) {
        const v = await this.prisma.voucher.findUnique({ where: { id }, select: { code: true } });
        return { doiTuong: v?.code ?? null };
      }
      if (p.startsWith('/users/:id')) {
        const u = await this.prisma.user.findUnique({ where: { id }, select: { fullName: true } });
        return { doiTuong: u?.fullName ?? null };
      }
    } catch {
      /* bỏ qua */
    }
    return {};
  }
}
