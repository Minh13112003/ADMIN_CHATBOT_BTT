# Guardrails, bắt buộc tuân thủ

- **Không xoá file hoặc dữ liệu** nếu người dùng chưa yêu cầu rõ. Thấy file thừa thì hỏi trước.
- **Commit và push chỉ khi được yêu cầu.**
- **Không đọc, in, hoặc commit bí mật:** `backend/.env`, `frontend/.env`, khoá `JWT_SECRET`, `INGEST_API_KEY`, mật khẩu Supabase. Chỉ commit `.env.example`.
- **Database thật là Supabase.** Không chạy `prisma migrate reset`, `prisma db push`, `pnpm smoke`, `pnpm simulate` khi `DATABASE_URL` trỏ tới Supabase thật (2 script đó ghi dữ liệu giả). Thử nghiệm thì dùng database riêng, xem skill `verify`.
- **Đổi cấu trúc bảng** chỉ qua `prisma migrate dev` tạo file migration, không sửa tay migration đã chạy.
- **Dùng pnpm**, không dùng npm hoặc yarn. Thêm gói có script cài đặt thì khai báo ở `allowBuilds` trong `pnpm-workspace.yaml`.
- **Log nội bộ không bao giờ được ra phía khách:** mọi API trả tin cho chatbot phải lọc `internal: false` và chỉ trả tin cần giao.
- **Khoá khung nhắn và phân quyền kiểm tra ở backend.** Frontend ẩn nút chỉ để dễ dùng, không phải để bảo vệ.
- Trước khi báo xong: chạy skill `verify`, nói thật phần nào đã kiểm tra và phần nào chưa.
