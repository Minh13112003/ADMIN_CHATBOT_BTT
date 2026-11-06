import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { JwtService } from '@nestjs/jwt';
import { ConnectedSocket, MessageBody, OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Role } from '../generated/prisma/client';
import { parseCookie } from 'cookie';
import { Server, Socket } from 'socket.io';
import { COOKIE_NAME } from '../auth/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

const ROOM = 'sales';

/** Đẩy sự kiện cho các sale đang mở trang. Xác thực bằng cookie đăng nhập. */
@WebSocketGateway({ namespace: 'realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private log = new Logger('Realtime');

  private redis?: ReturnType<typeof createClient>;
  constructor(private jwt: JwtService, private prisma: PrismaService, private config: ConfigService) {
    const url = this.config.get<string>('REDIS_URL');
    if (url) {
      const client = createClient({ url, socket: { connectTimeout: 3000, reconnectStrategy: false } });
      client.on('error', (error) => this.log.warn(`Redis đang soạn: ${error.message}`));
      void client.connect().then(() => { this.redis = client; }).catch((error) => this.log.warn(`Redis chưa sẵn sàng: ${(error as Error).message}`));
    }
  }

  async onModuleDestroy() {
    if (this.redis?.isOpen) await this.redis.quit();
  }

  async handleConnection(client: Socket) {
    try {
      const token = parseCookie(client.handshake.headers.cookie ?? '')[COOKIE_NAME];
      if (!token) throw new Error('no token');
      const { sub } = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.prisma.user.findUnique({ where: { id: sub }, select: { id: true, role: true, isActive: true, fullName: true } });
      if (!user?.isActive || (user.role !== Role.SALE && user.role !== Role.ADMIN)) throw new Error('forbidden');
      client.data.user = user;
      await client.join(ROOM);
      await client.join(`user:${user.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  /** Ai đang gõ ở hội thoại nào, giữ trong bộ nhớ (1 máy chủ). Không ghi database: gõ phím không được xoá dấu "vừa gửi" của người khác. */
  private dangGoMap = new Map<string, Map<string, { at: number; name: string }>>();

  /**
   * Sale đang gõ (giao diện gửi tối đa mỗi 5 giây): báo ngay cho cả nhóm để hiện "Minh đang soạn tin",
   * và ghi nhớ để người khác bấm gửi thì được hỏi lại. Không phát conversation:update để các trang khỏi tải lại danh sách.
   */
  @SubscribeMessage('typing')
  async typing(@ConnectedSocket() client: Socket, @MessageBody() body: { conversationId?: string }) {
    const user = client.data.user;
    if (!user || typeof body?.conversationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.conversationId)) return;
    const id = body.conversationId;
    const m = this.dangGoMap.get(id) ?? new Map<string, { at: number; name: string }>();
    m.set(user.id, { at: Date.now(), name: user.fullName });
    this.dangGoMap.set(id, m);
    if (this.dangGoMap.size > 2000) this.donDangGo();
    if (this.redis?.isReady) await this.redis.set(`typing:${id}:${user.id}`, user.fullName, { PX: 15_000 });
    client.to(ROOM).emit('typing', { conversationId: id, userId: user.id, name: user.fullName });
  }

  /** Đồng nghiệp (khác `userId`) gõ trong `trongMs` gần nhất ở hội thoại này, null nếu không có. */
  async dangGo(conversationId: string, userId: string, trongMs: number): Promise<{ id: string; name: string } | null> {
    if (this.redis?.isReady) {
      for await (const keys of this.redis.scanIterator({ MATCH: `typing:${conversationId}:*`, COUNT: 50 })) {
        for (const key of keys) {
          const id = key.slice(`typing:${conversationId}:`.length);
          if (id === userId) continue;
          const name = await this.redis.get(key);
          if (name) return { id, name };
        }
      }
    }
    const m = this.dangGoMap.get(conversationId);
    if (!m) return null;
    const moc = Date.now() - trongMs;
    for (const [id, v] of m) if (id !== userId && v.at >= moc) return { id, name: v.name };
    return null;
  }

  /** Người vừa gửi tin thì không còn "đang gõ". */
  async xongGo(conversationId: string, userId: string) {
    this.dangGoMap.get(conversationId)?.delete(userId);
    if (this.redis?.isReady) await this.redis.del(`typing:${conversationId}:${userId}`);
  }

  private donDangGo() {
    const moc = Date.now() - 60_000;
    for (const [id, m] of this.dangGoMap) {
      for (const [u, v] of m) if (v.at < moc) m.delete(u);
      if (!m.size) this.dangGoMap.delete(id);
    }
  }

  emit(event: 'conversation:update' | 'message:new' | 'contact:new' | 'support:new' | 'followup:due', payload: unknown) {
    this.server?.to(ROOM).emit(event, payload);
  }

  async disconnectUser(userId: string) {
    const clients = await this.server.in(`user:${userId}`).fetchSockets();
    for (const client of clients) client.disconnect(true);
  }
}
