// Prisma 7: cấu hình CLI (migrate, generate, seed). Không tự đọc .env nên phải nạp ở đây.
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Migrate cần phiên kết nối thật (khoá advisory), nên DATABASE_URL phải là Session pooler (cổng 5432)
    // hoặc kết nối trực tiếp, không phải Transaction pooler (cổng 6543).
    // Chưa đặt DATABASE_URL (ví dụ lúc `prisma generate` khi cài đặt) thì dùng chuỗi giữ chỗ để generate không báo lỗi.
    // Máy chủ `.invalid` không bao giờ tồn tại, nên migrate báo lỗi ngay chứ không nối nhầm vào database trên máy.
    url: process.env.DATABASE_URL ?? 'postgresql://chua-dat-DATABASE_URL@chua-dat-DATABASE_URL.invalid:5432/postgres',
  },
});
