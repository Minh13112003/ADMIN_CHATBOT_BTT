import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { AppModule } from './app.module';

// Prisma trả BigInt cho số tiền; JSON mặc định không chuyển được.
(BigInt.prototype as unknown as { toJSON(): number }).toJSON = function (this: bigint) {
  return Number(this);
};

class CorsIoAdapter extends IoAdapter {
  constructor(app: any, private origins: string[], private redisAdapter?: ReturnType<typeof createAdapter>) {
    super(app);
  }
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, { ...options, adapter: this.redisAdapter, cors: { origin: this.origins, credentials: true } });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const origins = (config.get<string>('FRONTEND_URL') ?? 'http://localhost:3002').split(',').map((s) => s.trim());

  // Chạy sau nginx: số tầng proxy tin cậy (1 = chỉ nginx kế bên). Không có thì mọi khách trông như cùng một IP
  // và giới hạn tốc độ (đăng nhập 10 lần/phút) sẽ tính chung cho cả công ty.
  const proxy = Number(config.get('TRUST_PROXY'));
  if (Number.isInteger(proxy) && proxy > 0) app.getHttpAdapter().getInstance().set('trust proxy', proxy);

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors({ origin: origins, credentials: true });
  let redisAdapter: ReturnType<typeof createAdapter> | undefined;
  const redisUrl = config.get<string>('REDIS_URL');
  if (redisUrl) {
    const pub = createClient({ url: redisUrl, socket: { connectTimeout: 3000, reconnectStrategy: false } });
    const sub = pub.duplicate();
    pub.on('error', () => {});
    sub.on('error', () => {});
    try {
      await Promise.all([pub.connect(), sub.connect()]);
      redisAdapter = createAdapter(pub, sub);
    } catch { /* Redis không sẵn: giữ chế độ một máy chủ. */ }
  }
  app.useWebSocketAdapter(new CorsIoAdapter(app, origins, redisAdapter));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: true }));

  await app.listen(Number(config.get('PORT') ?? 4000));
}
void bootstrap();
