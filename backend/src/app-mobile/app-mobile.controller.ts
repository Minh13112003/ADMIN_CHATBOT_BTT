import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsDateString, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { AuthUser, CurrentUser, Public } from '../auth/auth.decorators';
import { AppAccountService } from './app-account.service';
import { AppAuthGuard, AppUser, CurrentAppUser } from './app-auth.guard';

class LoginDto {
  /** Giữ tên trường của app cũ: số điện thoại đăng nhập. */
  @IsString() @MinLength(1, { message: 'Vui lòng nhập số điện thoại' }) @MaxLength(30) identifier: string;
  @IsString() @MinLength(1, { message: 'Vui lòng nhập mật khẩu' }) @MaxLength(200) password: string;
}

class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsEmail({}, { message: 'Email không hợp lệ' }) email?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsDateString({}, { message: 'Ngày sinh không hợp lệ' }) dateOfBirth?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsIn(['MALE', 'FEMALE', 'OTHER'], { message: 'Giới tính không hợp lệ' }) gender?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @Matches(/^(\d{9}|\d{12})$/, { message: 'CCCD phải gồm 9 hoặc 12 chữ số' }) nationalId?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(20) passportNumber?: string | null;
  @IsOptional() @ValidateIf((_, v) => v !== null && v !== '') @IsDateString({}, { message: 'Ngày hết hạn hộ chiếu không hợp lệ' }) passportExpiry?: string | null;
  /** App cũ gửi tuổi; không còn dùng (đã có ngày sinh) nhưng vẫn nhận để app cũ không bị báo lỗi. */
  @IsOptional() age?: number;
}

class ChangePasswordDto {
  @IsString() @MinLength(1, { message: 'Vui lòng nhập mật khẩu hiện tại' }) @MaxLength(200) currentPassword: string;
  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới cần ít nhất 8 ký tự' })
  @MaxLength(200)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, { message: 'Mật khẩu mới cần có chữ hoa, chữ thường và số' })
  newPassword: string;
}

const PIN = /^\d{6}$/;
class PinDto {
  @IsString() @Matches(PIN, { message: 'PIN phải đúng 6 chữ số' }) pin: string;
}
class ChangePinDto {
  @IsString() @Matches(PIN, { message: 'PIN cũ phải đúng 6 chữ số' }) currentPin: string;
  @IsString() @Matches(PIN, { message: 'PIN mới phải đúng 6 chữ số' }) newPin: string;
}
class FcmDto {
  @IsString() @MinLength(10) @MaxLength(4096) fcmToken: string;
}

/**
 * Đăng nhập app Mobile (chủ dự án chốt 2026-11-16): không có đăng ký trong app, tài khoản do sale tạo trong hộp thư.
 * @Public để bỏ qua AuthGuard cookie của nhân viên; app gửi token dạng Bearer.
 */
@Public()
@Controller('app/auth')
export class AppAuthController {
  constructor(private svc: AppAccountService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.svc.dangNhap(dto.identifier, dto.password);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh-token')
  @HttpCode(200)
  refresh(@Headers('authorization') auth: string | undefined) {
    return this.svc.lamMoi(auth);
  }

  @UseGuards(AppAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentAppUser() me: AppUser) {
    await this.svc.dangXuat(me.id);
    return { success: true };
  }
}

@Public()
@UseGuards(AppAuthGuard)
@Controller('app/users/me')
export class AppUsersController {
  constructor(private svc: AppAccountService) {}

  @Get()
  me(@CurrentAppUser() me: AppUser) {
    return this.svc.hoSo(me.id);
  }

  @Patch()
  update(@CurrentAppUser() me: AppUser, @Body() dto: UpdateProfileDto) {
    const { age: _, ...d } = dto;
    return this.svc.capNhatHoSo(me.id, d);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('password')
  password(@CurrentAppUser() me: AppUser, @Body() dto: ChangePasswordDto) {
    return this.svc.doiMatKhau(me.id, dto.currentPassword, dto.newPassword);
  }

  @Post('fcm-token')
  @HttpCode(200)
  fcm(@CurrentAppUser() me: AppUser, @Body() dto: FcmDto) {
    return this.svc.luuFcm(me.id, dto.fcmToken);
  }

  @Get('pin-status')
  pinStatus(@CurrentAppUser() me: AppUser) {
    return this.svc.trangThaiPin(me.id);
  }

  @Post('pin')
  @HttpCode(200)
  setPin(@CurrentAppUser() me: AppUser, @Body() dto: PinDto) {
    return this.svc.datPin(me.id, dto.pin);
  }

  // Giới hạn thử để không dò được mã PIN 6 số.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('pin/verify')
  @HttpCode(200)
  verifyPin(@CurrentAppUser() me: AppUser, @Body() dto: PinDto) {
    return this.svc.kiemPin(me.id, dto.pin);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Patch('pin')
  changePin(@CurrentAppUser() me: AppUser, @Body() dto: ChangePinDto) {
    return this.svc.doiPin(me.id, dto.currentPin, dto.newPin);
  }
}

/** Sale tạo tài khoản app cho khách trong menu ⋯ của hội thoại (SALE, ADMIN, DEPT_ADMIN theo mặc định của AuthGuard). */
@Controller('conversations')
export class ConversationAppAccountController {
  constructor(private svc: AppAccountService) {}

  @Get(':id/app-account')
  status(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.trangThai(id);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/app-account')
  @HttpCode(200)
  create(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.taoHoacCapLai(me, id);
  }
}
