import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../auth/auth.decorators';
import { AppAuthGuard, AppUser, CurrentAppUser } from './app-auth.guard';
import { AppBookingsService } from './app-bookings.service';

class GuestDto {
  @IsString() @MinLength(1, { message: 'Nhập họ tên hành khách' }) @MaxLength(120) fullName: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsDateString({}, { message: 'Ngày sinh hành khách không hợp lệ' }) dateOfBirth?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(['MALE', 'FEMALE', 'OTHER'], { message: 'Giới tính không hợp lệ' }) gender?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @Matches(/^(\d{9}|\d{12})$/, { message: 'CCCD phải gồm 9 hoặc 12 chữ số' }) nationalId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) passportNumber?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) phone?: string | null;
  /** App cũ gửi thêm, chưa dùng. */
  @IsOptional() visaNumber?: string | null;
}

class CreateBookingDto {
  @IsString() @MinLength(1, { message: 'Thiếu tour' }) @MaxLength(100) tourKey: string;
  @IsString() @MinLength(1, { message: 'Vui lòng chọn ngày khởi hành' }) @MaxLength(100) departureKey: string;
  @Type(() => Number) @IsInt() @Min(1, { message: 'Cần ít nhất 1 người lớn' }) @Max(50) adults: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) children?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) infants?: number;
  @IsOptional() @IsString() @MaxLength(40) voucherCode?: string;
  @IsOptional() @IsString() @MaxLength(1000) notice?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(150) @ValidateNested({ each: true }) @Type(() => GuestDto) guests?: GuestDto[];
  // App cũ gửi thêm các trường dưới; backend tự lấy giá và ngày từ website, không dùng giá trị app gửi.
  @IsOptional() departureDate?: string;
  @IsOptional() unitPrice?: number;
  @IsOptional() paymentMethod?: string;
  @IsOptional() idTour?: string;
  @IsOptional() departureId?: string;
  /** Chức năng thân nhân đã bỏ (chủ dự án 2026-11-16), app cũ có thể còn gửi. */
  @IsOptional() saveToRelatives?: number[];
}

export class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10_000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

class SeatsQuery {
  @IsString() @MaxLength(100) tourKey: string;
  @IsString() @MaxLength(100) departureKey: string;
}

class DoiTrangThaiDto {
  @IsIn(['DEPOSITED', 'PAID', 'REFUNDED'], { message: 'Trạng thái không hợp lệ' }) status: 'DEPOSITED' | 'PAID' | 'REFUNDED';
}

/** Đặt tour, lịch sử đặt tour trong app (đợt 2, docs/app-mobile-api.md). */
@Public()
@Controller('app/bookings')
export class AppBookingsController {
  constructor(private svc: AppBookingsService) {}

  @UseGuards(AppAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  create(@CurrentAppUser() me: AppUser, @Body() dto: CreateBookingDto) {
    const { departureDate: _a, unitPrice: _b, paymentMethod: _c, idTour: _d, departureId: _e, saveToRelatives: _f, ...d } = dto;
    return this.svc.datTour(me, d);
  }

  @UseGuards(AppAuthGuard)
  @Get('me')
  mine(@CurrentAppUser() me: AppUser, @Query() q: PageQuery) {
    return this.svc.lichSu(me, q.page ?? 1, q.limit ?? 20);
  }

  /** Công khai: khách chưa đăng nhập vẫn xem số chỗ còn. */
  @Get('laravel-seats')
  seats(@Query() q: SeatsQuery) {
    return this.svc.choCon(q.tourKey, q.departureKey);
  }

  @UseGuards(AppAuthGuard)
  @Get(':id')
  one(@CurrentAppUser() me: AppUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.chiTiet(me, id);
  }
}

/** Ngày khởi hành công khai. Voucher cần đăng nhập vì danh sách theo hạng thành viên và số lần khách đã dùng trong tháng. */
@Public()
@Controller('app')
export class AppCatalogController {
  constructor(private svc: AppBookingsService) {}

  @UseGuards(AppAuthGuard)
  @Get('vouchers')
  vouchers(@CurrentAppUser() me: AppUser, @Query() q: PageQuery) {
    return this.svc.voucher(me, q.page ?? 1, q.limit ?? 20);
  }

  @Get('departures/tour/:tourKey')
  departures(@Param('tourKey') tourKey: string) {
    return this.svc.dotKhoiHanh(tourKey.slice(0, 100));
  }
}

/** Sale bấm Đã cọc / Đã thanh toán / Đã hoàn tiền cho đơn khách đặt trong app. */
@Controller('conversations')
export class ConversationAppBookingController {
  constructor(private svc: AppBookingsService) {}

  @Post(':id/deals/:dealId/booking-status')
  @HttpCode(200)
  doi(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('dealId', ParseUUIDPipe) dealId: string, @Body() dto: DoiTrangThaiDto) {
    return this.svc.doiTrangThai(me, id, dealId, dto.status);
  }
}
