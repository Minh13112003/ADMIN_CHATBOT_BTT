// Prisma 7 nói chuyện với database qua driver `pg`, không còn engine riêng nên các tham số
// dành riêng cho Prisma trong chuỗi kết nối (`pgbouncer`, `connection_limit`) phải tự xử lý ở đây.
import type { PoolConfig } from 'pg';

const MAX_MAC_DINH = 10;

export function layCauHinhKetNoi(url: string | undefined): PoolConfig {
  if (!url) throw new Error('Thiếu DATABASE_URL trong backend/.env');

  const u = new URL(url);
  const gioiHan = Number(u.searchParams.get('connection_limit'));
  u.searchParams.delete('pgbouncer');
  u.searchParams.delete('connection_limit');

  const noiBo = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(u.hostname);
  // Chuỗi đã ghi rõ sslmode thì để driver tự hiểu; không thì bật SSL cho mọi máy chủ không phải máy mình
  // (Supabase bắt buộc mã hoá). Chứng chỉ của pooler Supabase không nằm trong kho tin cậy mặc định của Node.
  const coSslmode = u.searchParams.has('sslmode');

  return {
    connectionString: u.toString(),
    max: Number.isInteger(gioiHan) && gioiHan > 0 ? gioiHan : MAX_MAC_DINH,
    ...(noiBo || coSslmode ? {} : { ssl: { rejectUnauthorized: false } }),
  };
}
