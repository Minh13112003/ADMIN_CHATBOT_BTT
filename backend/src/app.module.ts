import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { AssignmentService } from './conversations/assignment.service';
import { ConversationsController, CustomersController, MessagesController } from './conversations/conversations.controller';
import { DealsController } from './conversations/deals.controller';
import { ConversationsService } from './conversations/conversations.service';
import { HealthController } from './health.controller';
import { IngestController, IngestKeyGuard } from './ingest/ingest.controller';
import { IngestService } from './ingest/ingest.service';
import { PrismaModule } from './prisma/prisma.service';
import { RealtimeGateway } from './realtime/realtime.gateway';
import { StorageModule } from './storage/storage.module';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';
import { AutoRepliesController, TemplatesController } from './templates/templates.controller';
import { UsersController } from './users/users.controller';
import { DepartmentsController } from './users/departments.controller';
import { TourInterestController } from './tour-interest/tour-interest.controller';
import { TourInterestService } from './tour-interest/tour-interest.service';
import { ConversationScopeGuard } from './conversations/scope.guard';
import { TourTagsController } from './tour-interest/tour-tags.controller';
import { ToursController } from './tours/tours.controller';
import { TourCatalogService } from './tours/tour-catalog.service';
import { PricingService } from './tours/pricing.service';
import { VouchersController } from './vouchers/vouchers.controller';
import { ChannelSettingsController } from './channels/channel-settings.controller';
import { ZaloOAuthController, ZaloWebhookController } from './channels/zalo.controller';
import { ZaloService } from './channels/zalo.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 600 }]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret || secret.length < 32) throw new Error('JWT_SECRET phải có ít nhất 32 ký tự');
        return { secret };
      },
    }),
    PrismaModule,
    StorageModule,
  ],
  controllers: [
    HealthController,
    AuthController,
    UsersController,
    DepartmentsController,
    TourInterestController,
    TourTagsController,
    ToursController,
    VouchersController,
    ChannelSettingsController,
    ZaloOAuthController,
    ZaloWebhookController,
    ConversationsController,
    CustomersController,
    DealsController,
    MessagesController,
    TemplatesController,
    AutoRepliesController,
    StatsController,
    IngestController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    IngestKeyGuard,
    ZaloService,
    IngestService,
    TourInterestService,
    TourCatalogService,
    PricingService,
    ConversationScopeGuard,
    ConversationsService,
    AssignmentService,
    StatsService,
    RealtimeGateway,
  ],
})
export class AppModule {}
