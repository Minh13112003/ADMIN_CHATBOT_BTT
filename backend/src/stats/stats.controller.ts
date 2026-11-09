import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/auth.decorators';
import { Role } from '../generated/prisma/client';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Granularity } from '../common/stats-series';
import { Period, StatsService } from './stats.service';

class StatsQuery {
  @IsOptional() @IsIn(['today', 'week', 'month', 'all']) period?: Period;
}

class SeriesQuery {
  @IsOptional() @IsIn(['day', 'week', 'month', 'quarter']) granularity?: Granularity;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(60) periods?: number;
}

const DEFAULT_PERIODS: Record<Granularity, number> = { day: 14, week: 12, month: 12, quarter: 8 };

@Controller('stats')
export class StatsController {
  constructor(private svc: StatsService) {}

  /** Thống kê (doanh thu, khách chi nhiều): chỉ admin. */
  @Roles(Role.ADMIN)
  @Get()
  get(@Query() q: StatsQuery) {
    return this.svc.get(q.period ?? 'month');
  }


  @Roles(Role.ADMIN)
  @Get('series')
  series(@Query() q: SeriesQuery) {
    const granularity = q.granularity ?? 'day';
    return this.svc.getSeries(granularity, q.periods ?? DEFAULT_PERIODS[granularity]);
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
