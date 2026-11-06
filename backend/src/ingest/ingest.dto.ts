import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsISO8601, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { BOOKING_STATUSES, BookingStatus } from '../common/deals';
import { Channel } from '../generated/prisma/client';

export class CustomerInfoDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
}

export class IdentifyDto {
  @IsEnum(Channel) channel: Channel;
  @IsString() @MinLength(1) @MaxLength(128) externalUserId: string;
  @IsString() @MinLength(1) @MaxLength(120) name: string;
  @IsString() @MaxLength(30) phone: string;
}

export class InboundDto {
  @IsEnum(Channel) channel: Channel;
  @IsString() @MinLength(1) @MaxLength(128) externalUserId: string;
  @IsString() @MinLength(1) @MaxLength(4000) text: string;
  @IsOptional() @ValidateNested() @Type(() => CustomerInfoDto) customer?: CustomerInfoDto;
  @IsOptional() @IsString() @MaxLength(128) externalMessageId?: string;
  /** Chatbot tự nhận ra khách cần nhân viên (ví dụ việc hoàn tiền của chính khách). */
  @IsOptional() @IsBoolean() wantsHuman?: boolean;
  @IsOptional() @IsString() @MaxLength(200) interest?: string;
}

/** Khách gửi ảnh hoặc PDF: multipart, các trường đều là chữ. `customer` là JSON {"name":..., "phone":...}. */
export class InboundFileDto {
  @IsEnum(Channel) channel: Channel;
  @IsString() @MinLength(1) @MaxLength(128) externalUserId: string;
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @IsString() @MaxLength(128) externalMessageId?: string;
  @IsOptional() @IsString() @MaxLength(1000) customer?: string;
}

export class BotReplyDto {
  @IsEnum(Channel) channel: Channel;
  @IsString() @MinLength(1) @MaxLength(128) externalUserId: string;
  @IsString() @MinLength(1) @MaxLength(8000) text: string;
  /** Không dùng ở đây, nhận để chatbot gửi chung một khối thông tin khách cho mọi lời gọi. */
  @IsOptional() @ValidateNested() @Type(() => CustomerInfoDto) customer?: CustomerInfoDto;
  @IsOptional() @IsArray() tours?: unknown[];
  @IsOptional() @IsString() @MaxLength(128) externalMessageId?: string;
  @IsOptional() @IsString() @MaxLength(80) model?: string;
  @IsOptional() @IsInt() @Min(0) inputTokens?: number;
  @IsOptional() @IsInt() @Min(0) outputTokens?: number;
}

export class HistoryMessageDto {
  @IsIn(['CUSTOMER', 'BOT']) senderType: 'CUSTOMER' | 'BOT';
  @IsString() @MinLength(1) @MaxLength(8000) text: string;
  @IsString() @MaxLength(128) externalMessageId: string;
  @IsISO8601() createdAt: string;
}

/** Chỉ ghi lại lịch sử: tin nhạy cảm đã bị chặn, nút bấm trong luồng đặt tour. Không báo nhân viên, không trả lời tự động. */
export class HistoryDto {
  @IsEnum(Channel) channel: Channel;
  @IsString() @MinLength(1) @MaxLength(128) externalUserId: string;
  @IsOptional() @ValidateNested() @Type(() => CustomerInfoDto) customer?: CustomerInfoDto;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => HistoryMessageDto) messages: HistoryMessageDto[];
}

export class UsageDto {
  @IsString() @MaxLength(80) model: string;
  @IsInt() @Min(0) inputTokens: number;
  @IsInt() @Min(0) outputTokens: number;
}

export class DealDto {
  @IsEnum(Channel) channel: Channel;
  @IsString() @MinLength(1) @MaxLength(128) externalUserId: string;
  @IsOptional() @ValidateNested() @Type(() => CustomerInfoDto) customer?: CustomerInfoDto;
  @IsString() @MinLength(2) @MaxLength(200) tourName: string;
  @IsInt() @Min(1) guests: number;
  @IsInt() @Min(0) amount: number;
  @IsOptional() @IsString() @MaxLength(60) orderCode?: string;
  /** Mã đợt khởi hành (tour_days[].code của benthanhtourist.com). */
  @IsOptional() @IsString() @MaxLength(60) tourCode?: string;
}

/** BE Mobile báo booking đổi trạng thái. `orderCode` là id booking, trùng `orderCode` chatbot gửi khi khách đặt. */
export class BookingStatusDto {
  @IsString() @MinLength(1) @MaxLength(60) orderCode: string;
  @IsIn(BOOKING_STATUSES as unknown as string[]) status: BookingStatus;
  @IsOptional() @IsISO8601() occurredAt?: string;
}

export class UpdatesQuery {
  @IsEnum(Channel) channel: Channel;
  @IsString() @MinLength(1) @MaxLength(128) externalUserId: string;
  @IsOptional() @IsString() after?: string;
}
