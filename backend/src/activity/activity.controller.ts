import { Controller, Get, Query } from '@nestjs/common';
import { IsDateString, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { Role } from '../generated/prisma/client';
import { Roles } from '../auth/auth.decorators';
import { NHOM_THAO_TAC, type NhomThaoTac } from '../common/activity';
import { ActivityService } from './activity.service';

class NgayQuery {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Ngày phải có dạng YYYY-MM-DD' }) date: string;
  @IsOptional() @IsUUID() actorId?: string;
  @IsOptional() @IsIn(NHOM_THAO_TAC) group?: NhomThaoTac;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsDateString() before?: string;
}

/** Nhật ký thao tác: chỉ admin toàn quyền, xem theo từng ngày (bảng có thể rất nhiều dòng). */
@Controller('activity-logs')
@Roles(Role.ADMIN)
export class ActivityController {
  constructor(private svc: ActivityService) {}

  @Get()
  ngay(@Query() q: NgayQuery) {
    return this.svc.ngay(q);
  }
}
