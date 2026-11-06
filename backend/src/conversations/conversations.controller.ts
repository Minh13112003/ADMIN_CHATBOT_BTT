import { BadRequestException, Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Channel, ConversationStatus } from '../generated/prisma/client';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
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
}

class StatusDto {
  @IsEnum(ConversationStatus) status: ConversationStatus;
}

class CloseDto {
  /** Xác nhận đơn khách đã tự đặt qua chatbot thay vì tạo đơn mới. */
  @IsOptional() @IsUUID() dealId?: string;
  @IsString() @MinLength(2, { message: 'Nhập tên tour' }) @MaxLength(200) tourName: string;
  @IsString({ message: 'Nhập mã tour' }) @MaxLength(60) tourCode: string;
  @Type(() => Number) @IsInt() @Min(1, { message: 'Số khách phải từ 1' }) @Max(1000) guests: number;
  @Type(() => Number) @IsInt() @Min(0, { message: 'Số tiền không hợp lệ' }) amount: number;
  @Transform(({ value }) => (typeof value === 'string' && value.trim() ? value.trim() : undefined))
  @IsOptional() @IsString() @MaxLength(60) orderCode?: string;
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
export class ConversationsController {
  constructor(private svc: ConversationsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser, @Query() q: ListQuery) {
    return this.svc.list(me, q);
  }

  @Get(':id')
  get(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.get(me, id);
  }

  @Get(':id/messages')
  messages(@Param('id', ParseUUIDPipe) id: string, @Query() q: MessagesQuery) {
    return this.svc.messages(id, q.before, q.take);
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
  list(@Query('search') search?: string) {
    return this.svc.customers(search);
  }

  @Get(':id/deals')
  deals(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.customerDeals(id);
  }
}

@Controller('messages')
export class MessagesController {
  constructor(private svc: ConversationsService) {}

  @Get('search')
  search(@Query() q: SearchMessagesQuery) {
    return this.svc.searchMessages(q.q);
  }
}
