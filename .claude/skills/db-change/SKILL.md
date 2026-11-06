---
name: db-change
description: Đổi cấu trúc database (thêm bảng, thêm cột, đổi kiểu). Dùng khi sửa backend/prisma/schema.prisma.
---

# Đổi cấu trúc database

1. Sửa `backend/prisma/schema.prisma`. Với bảng đã có dữ liệu thật: cột mới phải có giá trị mặc định hoặc cho phép trống; đổi tên hay xoá cột thì **hỏi người dùng trước** vì có thể mất dữ liệu.
   Đổi bảng khách, hội thoại, tin nhắn, đơn hoặc `ai_usage` thì sửa cả SQL trong `D:\ChatBot\lich_su_db.py`, vì chatbot ghi thẳng vào các bảng đó khi backend không chạy.
2. Tắt backend đang chạy (Windows giữ file Prisma, gây lỗi `EPERM`).
3. Tạo migration trên **database thử**: đặt `DATABASE_URL` trỏ tới database thử (cổng 5432) rồi chạy `pnpm --filter backend db:migrate --name <tên>`.
4. Đọc file SQL vừa sinh trong `backend/prisma/migrations/`, tìm `DROP` và báo nếu có.
5. Áp dụng lên Supabase bằng `pnpm db:deploy` **chỉ khi người dùng đồng ý**. Không dùng `migrate reset` hay `db push` trên Supabase.
6. Cập nhật `docs/data-model.md`, chạy skill `verify`.
