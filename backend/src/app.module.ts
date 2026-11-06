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
    ConversationsController,
    CustomersController,
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
    IngestService,
    ConversationsService,
    AssignmentService,
    StatsService,
    RealtimeGateway,
  ],
})
export class AppModule {}
