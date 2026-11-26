import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsDateString, IsIn, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { Role } from '../generated/prisma/client';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { BIEU_CAM } from '../common/reactions';
import { ConversationScopeGuard } from './scope.guard';
import { MessageActionsService } from './message-actions.service';
import { TrashService } from './trash.service';

class EditDto {
  @IsString() @MinLength(1, { message: 'Tin nhắn đang trống' }) @MaxLength(4000) text: string;
}

class ReactDto {
  /** null = gỡ biểu cảm của mình. Thả lại đúng biểu cảm đang có cũng là gỡ. */
  @ValidateIf((_, v) => v !== null) @IsIn(BIEU_CAM, { message: 'Biểu cảm không hợp lệ' }) emoji: string | null;
}

class TrangQuery {
  @IsOptional() @IsDateString() before?: string;
}

/** Thao tác trên từng tin: thả biểu cảm, sửa, xoá. Mặc định SALE, ADMIN, DEPT_ADMIN (trong phạm vi phòng); Digital chỉ xem. */
@Controller('conversations')
@UseGuards(ConversationScopeGuard)
export class MessageActionsController {
  constructor(private svc: MessageActionsService) {}

  @Post(':id/messages/:messageId/reaction')
  @HttpCode(200)
  react(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('messageId', ParseUUIDPipe) messageId: string, @Body() dto: ReactDto) {
    return this.svc.thaBieuCam(me, id, messageId, dto.emoji);
  }

  @Patch(':id/messages/:messageId')
  edit(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('messageId', ParseUUIDPipe) messageId: string, @Body() dto: EditDto) {
    return this.svc.sua(me, id, messageId, dto.text);
  }

  @Delete(':id/messages/:messageId')
  remove(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Param('messageId', ParseUUIDPipe) messageId: string) {
    return this.svc.xoa(me, id, messageId);
  }
}

/** Tab Khôi phục: chỉ admin toàn quyền. */
@Controller('trash')
@Roles(Role.ADMIN)
export class TrashController {
  constructor(private svc: TrashService) {}

  @Get('conversations')
  hoiThoai(@Query() q: TrangQuery) {
    return this.svc.hoiThoai(q.before);
  }

  @Get('conversations/:id/messages')
  tinCuaHoiThoai(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.tinCuaHoiThoai(id);
  }

  @Post('conversations/:id/restore')
  @HttpCode(200)
  khoiPhucHoiThoai(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.khoiPhucHoiThoai(me, id);
  }

  /** Xoá hẳn khỏi database. Có đơn đã chốt thì cần `?force=1` (409 HAS_DEALS). */
  @Delete('conversations/:id')
  xoaHanHoiThoai(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('force') force?: string) {
    return this.svc.xoaHanHoiThoai(me, id, force === '1');
  }

  @Get('messages')
  tin(@Query() q: TrangQuery) {
    return this.svc.tin(q.before);
  }

  @Post('messages/:id/restore')
  @HttpCode(200)
  khoiPhucTin(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.khoiPhucTin(me, id);
  }

  @Delete('messages/:id')
  xoaHanTin(@CurrentUser() me: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.xoaHanTin(me, id);
  }
}
