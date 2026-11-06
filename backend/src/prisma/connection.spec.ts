import { layCauHinhKetNoi } from './connection';

describe('layCauHinhKetNoi', () => {
  const pooler = 'postgresql://u:p@aws-0-x.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5';

  it('bỏ tham số riêng của Prisma và đổi connection_limit thành số kết nối tối đa', () => {
    const c = layCauHinhKetNoi(pooler);
    expect(c.connectionString).not.toContain('pgbouncer');
    expect(c.connectionString).not.toContain('connection_limit');
    expect(c.max).toBe(5);
  });

  it('bật SSL cho máy chủ từ xa', () => {
    expect(layCauHinhKetNoi(pooler).ssl).toEqual({ rejectUnauthorized: false });
  });

  it('không ép SSL khi chạy trên máy mình', () => {
    expect(layCauHinhKetNoi('postgresql://u:p@localhost:5432/db').ssl).toBeUndefined();
  });

  it('tôn trọng sslmode đã ghi trong chuỗi', () => {
    expect(layCauHinhKetNoi('postgresql://u:p@db.example.com:5432/db?sslmode=require').ssl).toBeUndefined();
  });

  it('dùng số mặc định khi không có connection_limit hoặc giá trị sai', () => {
    expect(layCauHinhKetNoi('postgresql://u:p@localhost:5432/db').max).toBe(10);
    expect(layCauHinhKetNoi('postgresql://u:p@localhost:5432/db?connection_limit=abc').max).toBe(10);
  });

  it('báo lỗi rõ khi thiếu DATABASE_URL', () => {
    expect(() => layCauHinhKetNoi(undefined)).toThrow('DATABASE_URL');
  });
});
