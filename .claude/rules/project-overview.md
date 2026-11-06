# Tổng quan dự án

| Phần | Công nghệ | Thư mục | Cổng |
|---|---|---|---|
| Backend | NestJS 11, Prisma 7, Socket.IO | `backend/` | 4000, prefix `/api/v1` |
| Frontend | React 19, Vite 8, React Router, Tailwind 4, SWR | `frontend/` | 3002 (3000 trùng app khác trên máy) |
| Database | PostgreSQL trên Supabase | `backend/prisma/` | |

pnpm workspace ở thư mục gốc. NestJS 11 cùng phiên bản với backend chính của công ty (`D:\E-Commerce\Backend\e-commerce`). Prisma đã nâng lên 7 (backend chính có thể còn Prisma 6), nên không dùng chung client được.

## Hệ thống liên quan

- **Chatbot bttAI** (`D:\ChatBot`, FastAPI, Gemini): chatbot chính, phục vụ app mobile và web. Đã nối vào trang này, xem `integrations.md`.
- **App mobile** (`D:\App Mobile\MyFirstApp`, Expo) và **Zalo Mini App**: phía khách, đang gọi trực tiếp chatbot.
- **Backend NestJS chính** (`D:\E-Commerce\Backend\e-commerce`): tài khoản khách và đơn đặt tour.
- **Bản phác thảo giao diện đã được duyệt:** https://claude.ai/artifact/Xr4XP1FwcHKsgqd4nHsnj2

## Cấu trúc

```
backend/src/
  common/         Hàm thuần có test: text (tên, SĐT, đòi gặp nhân viên), locks, assignment, auto-reply
  auth/           Đăng nhập cookie, AuthGuard toàn cục, @Public, @Roles, @CurrentUser
  users/          Admin tạo tài khoản; sale bật/tắt đang trực
  conversations/  Hội thoại, gửi tin, nhận xử lý, xử lý hộ, chốt tour; assignment.service chia việc
  ingest/         Cổng cho chatbot đẩy dữ liệu vào, bảo vệ bằng x-ingest-key
  templates/      Mẫu trả lời nhanh, quy tắc trả lời tự động
  stats/          Thống kê, lưu tạm 5 phút
  realtime/       Socket.IO, namespace /realtime
backend/scripts/  smoke.ts (kiểm thử toàn luồng), simulate-chat.ts (dữ liệu giả)
frontend/src/
  App.tsx         Khai báo đường dẫn: /login, /inbox, /customers, /templates, /settings (sale và admin), /stats, /accounts (chỉ admin)
  pages/          Mỗi trang một file
  components/     Shell, RequireAuth, inbox/{ConversationList,ChatPane,InfoPanel,MessageBubble}, ui
  lib/            api, types, labels, realtime
```

## Lệnh hay dùng

```
pnpm dev:be | pnpm dev:fe    Chạy phát triển
pnpm test                    Test đơn vị backend
pnpm typecheck | pnpm build  Kiểm tra kiểu, build cả 2
pnpm db:deploy | pnpm db:seed
```
