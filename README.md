# btt-chat-admin

Trang quản trị tin nhắn chatbot BenThanh Tourist. React + Vite + NestJS + PostgreSQL (Supabase).

## Cài đặt lần đầu

Cần Node 22 và pnpm.

```
pnpm install
pnpm setup:env
```

`setup:env` tạo `backend/.env` và `frontend/.env`, sinh sẵn khoá bí mật. Không ghi đè file đã có.

### Nối Supabase

1. Tạo project trên Supabase, vào **Project Settings > Database > Connection string**.
2. Mở `backend/.env`, thay `PROJECT_REF`, `PASSWORD`, `REGION` trong dòng `DATABASE_URL`. Dùng Session pooler, cổng 5432 (Prisma 7 chỉ cần một địa chỉ này; Transaction pooler cổng 6543 không chạy được migrate).
3. Tạo bảng, mẫu mặc định và tài khoản admin (mật khẩu có ký tự đặc biệt thì đặt trong dấu nháy đơn):

```
pnpm db:deploy
pnpm db:seed
pnpm --filter backend create-admin email@congty.vn 'MatKhau#123' "Tên hiển thị"
```

## Chạy

Mở 2 cửa sổ:

```
pnpm dev:be
pnpm dev:fe
```

Vào http://localhost:3002, đăng nhập bằng tài khoản admin vừa tạo. Admin quản lý tài khoản và xem thống kê; tài khoản sale dùng để nhắn tin với khách. Nên đổi mật khẩu admin sau lần đăng nhập đầu.

Sale và admin mở **Cài đặt** từ thanh điều hướng hoặc menu tài khoản để đổi sáng/tối, màu nhấn, cỡ chữ, mật độ danh sách và chuyển động. Tùy chọn lưu trên trình duyệt. Trang **Thống kê** của admin có biểu đồ theo ngày/tuần/tháng/quý và chi phí AI theo nguồn; API `/stats/series` và `/stats/cost-by-source` chỉ dành cho admin, lưu tạm 5 phút.

## Xem thử khi chưa nối chatbot

Trên **database thử**, chạy `pnpm simulate` để có vài hội thoại giả. Không chạy trên database thật.

## Tài liệu

- [CLAUDE.md](CLAUDE.md): Claude Code tự đọc khi mở thư mục này
- [docs/ingest-api.md](docs/ingest-api.md): cách chatbot đẩy dữ liệu vào
- [docs/data-model.md](docs/data-model.md): các bảng dữ liệu
- [docs/roadmap.md](docs/roadmap.md): việc chưa làm
