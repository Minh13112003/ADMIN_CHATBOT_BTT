# Backend NestJS + Socket.IO (cùng một tiến trình, cổng 4000).
# Build từ THƯ MỤC GỐC của dự án (pnpm workspace):  docker build -f backend/Dockerfile -t btt-backend .
FROM node:22-bookworm-slim

# openssl: công cụ migrate của Prisma cần. ca-certificates: gọi API website tour, Supabase Storage.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable

WORKDIR /app

# Lớp cài gói tách riêng để tận dụng cache: chỉ chạy lại khi lock file hoặc schema đổi.
# `postinstall` của backend chạy `prisma generate` nên cần schema và prisma.config.ts có mặt trước khi cài.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/prisma.config.ts ./backend/
COPY backend/prisma ./backend/prisma
COPY frontend/package.json ./frontend/
RUN pnpm install --frozen-lockfile --filter backend...

COPY backend ./backend
RUN pnpm --filter backend build

# Giữ cả devDependencies vì cần công cụ `prisma` để chạy migrate trong container này.
ENV NODE_ENV=production
# Thư mục lưu ảnh/PDF (compose gắn volume vào đây). Tạo sẵn và giao cho user node, nếu không volume mới sẽ thuộc root và backend không ghi được.
RUN mkdir -p /data/files && chown node:node /data/files
WORKDIR /app/backend
USER node
EXPOSE 4000

# /api/v1/health là route công khai (không cần đăng nhập).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main"]
