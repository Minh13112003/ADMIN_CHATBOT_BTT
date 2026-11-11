import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { ngayVietNam } from '../common/tours';
import { chuanHoaMaVoucher, kiemTraVoucher, moTaMucGiam, trangThaiVoucher } from '../common/vouchers';
import { Prisma, Role, type Voucher } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TourCatalogService } from '../tours/tour-catalog.service';
import { voucherRule } from '../tours/pricing.service';

const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const rong = ({ value }: { value: unknown }) => (value === '' || value === null ? undefined : value);

class VoucherDto {
  @IsString() @MaxLength(40) code: string;
  @IsIn(['AMOUNT', 'PERCENT'], { message: 'Chọn kiểu giảm' }) type: 'AMOUNT' | 'PERCENT';
  @Type(() => Number) @IsInt({ message: 'Giá trị giảm phải là số nguyên' }) @Min(1, { message: 'Giá trị giảm phải lớn hơn 0' }) @Max(1_000_000_000) value: number;
  @Transform(rong) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1_000_000_000) maxDiscount?: number;
  @IsIn(['TOUR', 'CATEGORY', 'ALL'], { message: 'Chọn phạm vi áp dụng' }) scope: 'TOUR' | 'CATEGORY' | 'ALL';
  @ValidateIf((o: VoucherDto) => o.scope === 'TOUR') @IsString({ message: 'Chọn tour áp dụng' }) @MaxLength(100) tourKey?: string;
  @ValidateIf((o: VoucherDto) => o.scope === 'CATEGORY') @Type(() => Number) @IsInt({ message: 'Chọn địa điểm áp dụng' }) categoryId?: number;
  @Matches(NGAY, { message: 'Ngày bắt đầu không hợp lệ' }) startsOn: string;
  @Matches(NGAY, { message: 'Ngày kết thúc không hợp lệ' }) endsOn: string;
  @Transform(rong) @IsOptional() @Type(() => Number) @IsInt() @Min(1, { message: 'Số lần dùng tối đa phải từ 1' }) @Max(1_000_000) maxUses?: number;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class ActiveDto {
  @IsBoolean() isActive: boolean;
}

/** Voucher: chỉ admin phòng ban (admin chi nhánh) và admin toàn quyền. Admin phòng chỉ thấy, sửa voucher của phòng mình. */
@Roles(Role.ADMIN, Role.DEPT_ADMIN)
@Controller('vouchers')
export class VouchersController {
  constructor(private prisma: PrismaService, private catalog: TourCatalogService) {}

  private pham(me: AuthUser): Prisma.VoucherWhereInput {
    return me.role === Role.ADMIN ? {} : { departmentId: me.departmentId ?? '__khong_co__' };
  }

  private async dung(ids: string[]) {
    if (!ids.length) return new Map<string, number>();
    const rows = await this.prisma.deal.groupBy({ by: ['voucherId'], where: { voucherId: { in: ids }, status: 'CONFIRMED', voidedAt: null }, _count: { _all: true } });
    return new Map(rows.map((r) => [r.voucherId!, r._count._all]));
  }

  private ra(v: Voucher, used: number, now = new Date()) {
    return {
      id: v.id, code: v.code, type: v.type, value: v.value, maxDiscount: v.maxDiscount === null ? null : Number(v.maxDiscount),
      scope: v.scope, tourKey: v.tourKey, tourName: v.tourName, categoryId: v.categoryId, categoryName: v.categoryName,
      startsAt: v.startsAt, endsAt: v.endsAt, maxUses: v.maxUses, used, note: v.note, isActive: v.isActive,
      label: moTaMucGiam(voucherRule(v)), status: trangThaiVoucher(voucherRule(v), now, used),
    };
  }

  @Get()
  async list(@CurrentUser() me: AuthUser) {
    const rows = await this.prisma.voucher.findMany({ where: this.pham(me), orderBy: { createdAt: 'desc' }, take: 500 });
    const used = await this.dung(rows.map((r) => r.id));
    const now = new Date();
    const items = rows.map((v) => this.ra(v, used.get(v.id) ?? 0, now));
    const thang = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit' }).format(now);
    const dauThang = ngayVietNam(`${thang}-01`)!;
    const usedThisMonth = await this.prisma.deal.count({
      where: { voucherId: { not: null }, status: 'CONFIRMED', voidedAt: null, closedAt: { gte: dauThang }, voucher: this.pham(me) },
    });
    const tuanToi = new Date(now.getTime() + 7 * 86_400_000);
    return {
      summary: {
        active: items.filter((v) => v.status === 'ACTIVE').length,
        usedThisMonth,
        expiringSoon: items.filter((v) => v.status === 'ACTIVE' && v.endsAt <= tuanToi).length,
      },
      items,
    };
  }

  /** Tên tour, địa điểm lấy từ danh mục ở backend, không tin chữ trình duyệt gửi. */
  private async duLieu(dto: VoucherDto) {
    const code = chuanHoaMaVoucher(dto.code);
    if (!code) throw new BadRequestException('Mã voucher gồm 3-30 chữ, số, dấu - hoặc _');
    const startsAt = ngayVietNam(dto.startsOn);
    const endsAt = ngayVietNam(dto.endsOn, true);
    if (!startsAt || !endsAt) throw new BadRequestException('Ngày không hợp lệ');
    const data = {
      code, type: dto.type, value: dto.value, maxDiscount: dto.type === 'PERCENT' && dto.maxDiscount ? BigInt(dto.maxDiscount) : null,
      scope: dto.scope, tourKey: null as string | null, tourName: null as string | null, categoryId: null as number | null, categoryName: null as string | null,
      startsAt, endsAt, maxUses: dto.maxUses ?? null, note: dto.note?.trim() || null,
    };
    if (dto.scope === 'TOUR' && dto.tourKey) {
      const t = await this.catalog.chiTietTour(dto.tourKey);
      Object.assign(data, { tourKey: t.key, tourName: t.name });
    }
    if (dto.scope === 'CATEGORY' && dto.categoryId !== undefined) {
      const p = (await this.catalog.diaDiem()).find((x) => x.id === dto.categoryId);
      if (!p) throw new BadRequestException('Không tìm thấy địa điểm này');
      Object.assign(data, { categoryId: p.id, categoryName: p.name });
    }
    const loi = kiemTraVoucher({ ...data, maxDiscount: data.maxDiscount === null ? null : Number(data.maxDiscount) });
    if (loi) throw new BadRequestException(loi);
    return data;
  }

  private async cuaToi(me: AuthUser, id: string) {
    const v = await this.prisma.voucher.findFirst({ where: { id, ...this.pham(me) } });
    if (!v) throw new NotFoundException('Không tìm thấy voucher');
    return v;
  }

  @Post()
  async create(@CurrentUser() me: AuthUser, @Body() dto: VoucherDto) {
    if (me.role === Role.DEPT_ADMIN && !me.departmentId) throw new ForbiddenException('Tài khoản chưa có phòng ban');
    const data = await this.duLieu(dto);
    try {
      const v = await this.prisma.voucher.create({ data: { ...data, departmentId: me.role === Role.ADMIN ? null : me.departmentId, createdById: me.id } });
      return this.ra(v, 0);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Mã voucher này đã có');
      throw e;
    }
  }

  @Patch(':id')
  async update(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: VoucherDto) {
    await this.cuaToi(me, id);
    const data = await this.duLieu(dto);
    try {
      const v = await this.prisma.voucher.update({ where: { id }, data });
      return this.ra(v, (await this.dung([id])).get(id) ?? 0);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Mã voucher này đã có');
      throw e;
    }
  }

  /** Tạm khoá hoặc mở lại. Không xoá voucher để đơn cũ vẫn biết đã dùng mã nào. */
  @Patch(':id/active')
  async active(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ActiveDto) {
    await this.cuaToi(me, id);
    const v = await this.prisma.voucher.update({ where: { id }, data: { isActive: dto.isActive } });
    return this.ra(v, (await this.dung([id])).get(id) ?? 0);
  }
}
