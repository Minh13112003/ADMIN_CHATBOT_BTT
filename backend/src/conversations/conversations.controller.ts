import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Channel, ConversationStatus, Role } from '../generated/prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { ConversationScopeGuard } from './scope.guard';
import { GIOI_HAN_TEP_TOI_DA } from '../common/attachments';
import { ConversationsService } from './conversations.service';

class ListQuery {
  @IsOptional() @IsEnum(ConversationStatus) status?: ConversationStatus;
  @IsOptional() @IsEnum(Channel) channel?: Channel;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) take?: number;
  @IsOptional() @IsString() @MaxLength(40) tag?: string;
  @IsOptional() @Transform(({ value }) => value === '1' || value === 'true' || value === true) @IsBoolean() followUp?: boolean;
}

class MessagesQuery {
  @IsOptional() @IsString() before?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) take?: number;
  /** Mở thẳng tới một tin (link "Mở tin nhắn" của Digital): tải tin đó, vài tin trước và các tin sau. */
  @IsOptional() @IsUUID() around?: string;
}

class SendDto {
  @IsString() @MinLength(1) @MaxLength(4000) text: string;
  /** Đã xác nhận gửi dù đồng nghiệp đang nhắn. */
  @IsOptional() @IsBoolean() confirm?: boolean;
  @IsOptional() @IsUUID() replyToId?: string;
}

/** Gửi kèm file: các trường đi dạng multipart nên `confirm` đến dưới dạng chữ "true". */
class SendFileDto {
  @IsOptional() @IsString() @MaxLength(4000) text?: string;
  @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() confirm?: boolean;
  @IsOptional() @IsUUID() replyToId?: string;
}

class HandoverDto {
  @IsUUID() toUserId: string;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class CancelDealDto {
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class SearchMessagesQuery {
  @IsString() @MinLength(1) @MaxLength(100) q: string;
  /** Chỉ tìm trong một hội thoại (dòng tìm tin trong khung chat). */
  @IsOptional() @IsUUID() conversationId?: string;
}

class StatusDto {
  @IsEnum(ConversationStatus) status: ConversationStatus;
}

/**
 * Chốt tour: sale chỉ chọn tour, ngày khởi hành (mã đợt), số khách và voucher. Giá và tổng tiền backend tự tính
 * từ API tour (PricingService), không nhận từ trình duyệt.
 */
class CloseDto {
  /** Xác nhận đơn khách đã tự đặt qua chatbot thay vì tạo đơn mới. */
  @IsOptional() @IsUUID() dealId?: string;
  @IsOptional() @IsString() @MaxLength(100) tourKey?: string;
  @IsString({ message: 'Chọn ngày khởi hành' }) @MaxLength(60) dayCode: string;
  @Type(() => Number) @IsInt() @Min(1, { message: 'Số khách phải từ 1' }) @Max(1000) guests: number;
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsOptional() @IsString() @MaxLength(40) voucherCode?: string;
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsOptional() @IsString() @MaxLength(60) orderCode?: string;
}

class OrderCodeParam {
  @IsString() @MinLength(1) @MaxLength(60) code: string;
}

class PatchDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(4000) note?: string;
  @IsOptional() @IsString() @MaxLength(200) interest?: string;
  @IsOptional() @IsBoolean() autoReplyOn?: boolean;
  /** null = bỏ hẹn. */
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsDateString({}, { message: 'Giờ hẹn không hợp lệ' }) followUpAt?: string | null;
  @IsOptional() @IsString() @MaxLength(300) followUpNote?: string;
}

@Controller('conversations')
@UseGuards(ConversationScopeGuard)
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser, @Query() q: ListQuery) {
    return this.svc.list(me, q);
  }

  /** Digital xem được một hội thoại trong phạm vi để đọc tin gốc; ConversationScopeGuard kiểm tra phạm vi. */
  @Get(':id')
  @Roles(Role.SALE, Role.ADMIN, Role.DEPT_ADMIN, Role.DIGITAL)
  get(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(me, id);
  }

  /** Xoá hội thoại (dùng dọn dữ liệu thử): chỉ admin toàn quyền. Có đơn đã chốt thì cần `?force=1`. */
  @Delete(':id')
  @Roles(Role.ADMIN)
  xoa(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('force') force?: string) {
    return this.svc.xoaHoiThoai(me, id, force === '1');
  }

  @Get(':id/messages')
  @Roles(Role.SALE, Role.ADMIN, Role.DEPT_ADMIN, Role.DIGITAL)
  messages(@Param('id', ParseUUIDPipe) id: string, @Query() q: MessagesQuery) {
    return this.svc.messages(id, q.before, q.take, q.around);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.read(me, id);
  }

  @Post(':id/messages')
  send(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendDto) {
    return this.svc.send(me, id, dto);
  }

  /** Gửi ảnh (JPG, PNG, WebP) hoặc PDF, kèm chữ nếu muốn. Loại file kiểm tra ở backend theo nội dung. */
  @Post(':id/messages/file')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: GIOI_HAN_TEP_TOI_DA, files: 1 } }))
  sendFile(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: SendFileDto, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file');
    return this.svc.send(me, id, dto, file);
  }

  @Post(':id/give-back')
  @HttpCode(200)
  giveBack(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.giveBack(me, id);
  }

  @Post(':id/handover')
  @HttpCode(200)
  handover(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: HandoverDto) {
    return this.svc.handover(me, id, dto.toUserId, dto.note);
  }

  @Post(':id/status')
  @HttpCode(200)
  status(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: StatusDto) {
    return this.svc.setStatus(me, id, dto.status);
  }

  @Post(':id/close')
  @HttpCode(200)
  close(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseDto) {
    return this.svc.close(me, id, dto);
  }

  /** Tab "Theo mã đơn": tìm đơn khách đã đặt qua chatbot theo mã đơn, chỉ trong hội thoại này. */
  @Get(':id/deals/by-order/:code')
  dealByOrder(@Param('id', ParseUUIDPipe) id: string, @Param() p: OrderCodeParam) {
    return this.svc.dealByOrder(id, p.code);
  }

  @Post(':id/deals/:dealId/cancel')
  @HttpCode(200)
  cancelDeal(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('dealId', ParseUUIDPipe) dealId: string, @Body() dto: CancelDealDto) {
    return this.svc.cancelDeal(me, id, dealId, dto.reason);
  }

  @Patch(':id')
  patch(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchDto) {
    return this.svc.patch(me, id, dto);
  }
}

@Controller('customers')
export class CustomersController {
  constructor(private svc: ConversationsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser, @Query('search') search?: string) {
    return this.svc.customers(me, search);
  }

  @Get(':id/deals')
  deals(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.customerDeals(me, id);
  }
}

@Controller('messages')
export class MessagesController {
  constructor(private svc: ConversationsService) {}

  @Get('search')
  search(@CurrentUser() me: AuthUser, @Query() q: SearchMessagesQuery) {
    return this.svc.searchMessages(me, q.q, q.conversationId ? 200 : 50, q.conversationId);
  }
}
