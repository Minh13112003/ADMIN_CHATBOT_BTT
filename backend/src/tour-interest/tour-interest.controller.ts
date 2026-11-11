import { Controller, Get, Query } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Role } from '../generated/prisma/client';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.decorators';
import { TourInterestService, type Bo } from './tour-interest.service';

class KyQuery {
  /** Số ngày gần đây; không gửi = từ trước đến nay. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) days?: number;
  @IsOptional() @IsIn(['WEB', 'APP', 'ZALO', 'FACEBOOK']) channel?: string;
}

class RankingQuery extends KyQuery {
  @IsOptional() @IsIn(['tour', 'place']) view?: 'tour' | 'place';
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number;
  /** Chỉ tour mới xuất hiện trong 30 ngày qua. */
  @IsOptional() @Transform(({ value }) => value === '1' || value === 'true' || value === true) @IsBoolean() moi?: boolean;
}

class KeyQuery extends KyQuery {
  @IsString() @MaxLength(300) key: string;
}

const ky = (q: KyQuery): Bo => ({ tu: q.days ? new Date(Date.now() - q.days * 86_400_000) : undefined, kenh: q.channel });

/** Nhu cầu tour: admin toàn quyền, admin phòng và Digital, mỗi người chỉ trong phạm vi phòng của mình. */
@Roles(Role.ADMIN, Role.DEPT_ADMIN, Role.DIGITAL)
@Controller('tour-interest')
export class TourInterestController {
  constructor(private svc: TourInterestService) {}

  @Get()
  ranking(@CurrentUser() me: AuthUser, @Query() q: RankingQuery) {
    return this.svc.ranking(me, { view: q.view ?? 'tour', search: q.search, take: q.take ?? 10, skip: q.skip ?? 0, moi: q.moi, ...ky(q) });
  }

  /** Hộp "Thống kê tour". `key` là tên tour bỏ dấu (trường `key` của bảng xếp hạng). */
  @Get('detail')
  detail(@CurrentUser() me: AuthUser, @Query() q: KeyQuery) {
    return this.svc.detail(me, q.key, ky(q));
  }

  @Get('askers')
  askers(@CurrentUser() me: AuthUser, @Query() q: KeyQuery) {
    return this.svc.askers(me, q.key, ky(q));
  }
}
