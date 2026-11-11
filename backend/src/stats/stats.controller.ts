import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators';
import { Role } from '../generated/prisma/client';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthUser, CurrentUser } from '../auth/auth.decorators';
import { phamViThongKe } from '../common/scope';
import { Granularity } from '../common/stats-series';
import { Period, StatsService } from './stats.service';

class StatsQuery {
  @IsOptional() @IsIn(['today', 'week', 'month', 'all']) period?: Period;
  /** Admin toàn quyền lọc theo một phòng; admin phòng bị giới hạn ở phòng mình dù gửi gì. */
  @IsOptional() @IsString() @MaxLength(60) departmentId?: string;
}

class OrdersQuery extends StatsQuery {
  @IsOptional() @IsIn(['CONFIRMED', 'PENDING', 'CANCELLED']) status?: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
  @IsOptional() @IsString() @MaxLength(120) search?: string;
  @IsOptional() @IsString() @MaxLength(60) staffId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}

class SeriesQuery {
  @IsOptional() @IsIn(['today', 'week', 'month', 'all']) period?: Period;
  @IsOptional() @IsIn(['day', 'week', 'month', 'quarter']) granularity?: Granularity;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) periods?: number;
  @IsOptional() @IsString() @MaxLength(60) departmentId?: string;
}

const DEFAULT_PERIODS: Record<Granularity, number> = { day: 14, week: 12, month: 12, quarter: 8 };

@Controller('stats')
export class StatsController {
  constructor(private svc: StatsService) {}

  /** Thống kê (doanh thu, khách chi nhiều): chỉ admin. */
  @Roles(Role.ADMIN, Role.DEPT_ADMIN)
  @Get()
  get(@CurrentUser() me: AuthUser, @Query() q: StatsQuery) {
    return this.svc.get(q.period ?? 'month', phamViThongKe(me, q.departmentId));
  }

  @Roles(Role.ADMIN, Role.DEPT_ADMIN)
  @Get('orders')
  orders(@CurrentUser() me: AuthUser, @Query() q: OrdersQuery) {
    return this.svc.getOrders(q.period ?? 'month', phamViThongKe(me, q.departmentId), q);
  }


  @Roles(Role.ADMIN, Role.DEPT_ADMIN)
  @Get('series')
  series(@CurrentUser() me: AuthUser, @Query() q: SeriesQuery) {
    const granularity = q.granularity ?? 'day';
    return this.svc.getSeries(granularity, q.periods ?? DEFAULT_PERIODS[granularity], phamViThongKe(me, q.departmentId), q.period);
  }

  @Roles(Role.ADMIN)
  @Get('cost-by-source')
  costBySource(@Query() q: StatsQuery) {
    return this.svc.getCostBySource(q.period ?? 'month');
  }

  @Roles(Role.ADMIN)
  @Get('channels')
  channels() {
    return this.svc.getChannels();
  }
}
