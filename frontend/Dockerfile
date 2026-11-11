# Frontend: build ra file tĩnh rồi cho nginx phục vụ (cổng 80 trong container).
# Build từ THƯ MỤC GỐC của dự án:  docker build -f frontend/Dockerfile -t btt-web .
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
# `--ignore-scripts`: chỉ cần gói frontend, không chạy `prisma generate` của backend.
RUN pnpm install --frozen-lockfile --filter frontend... --ignore-scripts

COPY frontend ./frontend
# Rỗng = gọi API và socket cùng tên miền với trang (/api/v1, /socket.io), nginx phía trước chuyển tiếp về backend.
# Muốn đặt backend ở tên miền khác thì truyền --build-arg VITE_API_URL=https://api.example.com
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter frontend build

FROM nginx:1.27-alpine
COPY deploy/nginx-web.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
