Dự án gồm 4 phần trên máy này: trang quản trị chat D:\btt-chat-admin (NestJS 11, Prisma 7, React 19 + Vite), chatbot D:\ChatBot (FastAPI), App Mobile D:\App Mobile\MyFirstApp (Expo, kèm thư mục zalo-miniapp), và BE Mobile D:\E-Commerce\Backend\e-commerce (NestJS). Mỗi phần có file quy tắc riêng, đọc trước khi sửa: CLAUDE.md và toàn bộ .claude/rules/ trong thư mục đó (nhất là guardrails.md).
Quy tắc chung:

Không đọc, in hay commit file .env hoặc bí mật. Không commit và không push.
Không chạy prisma migrate reset, db push, pnpm smoke, pnpm simulate trên Supabase thật; thử trên Postgres cục bộ riêng.
Đổi cấu trúc bảng chỉ qua prisma migrate dev, và nếu đổi bảng customers, customer_identities, conversations, messages, deals, ai_usage thì phải sửa D:\ChatBot\lich_su_db.py (file này viết SQL tay).
Logic quyết định đặt ở hàm thuần trong backend/src/common/ kèm test .spec.ts.
Chữ giao diện là tiếng Việt có dấu, không dùng emoji, không dùng alert hay confirm của trình duyệt.
Xong thì chạy pnpm typecheck, pnpm test, pnpm build ở trang quản trị (chatbot dùng python -m unittest discover -s tests -t .), rồi báo thật phần nào đã kiểm tra, phần nào chưa.
