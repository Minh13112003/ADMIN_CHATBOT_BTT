# Kho sticker và bảng chọn trong chat

## Sử dụng

- Admin mở **Kho sticker** (`/stickers`) và tải file `.webp` (tối đa 5 MB/file). Có thể chọn nhiều file; giao diện giãn lượt để tuân thủ giới hạn 20 upload/phút.
- Sale bấm biểu tượng sticker trong ô soạn tin. Bảng nổi ngay phía trên nút, có tìm kiếm, lưới 4 cột và danh sách gần đây theo tài khoản trên trình duyệt.
- Chọn sticker chỉ đưa vào vùng xem trước. **Bấm Gửi mới tạo tin nhắn**. Bản nháp chữ vẫn được giữ lại.
- Danh sách gần đây chỉ cập nhật khi gửi thành công. Bấm bên ngoài hoặc Escape đóng bảng chọn.
- Ẩn khỏi kho không xoá các tin nhắn đã gửi.

## Bộ Ami Fat Cat

50 GIF gốc ở `D:\Ami-Fat-Cat-Stickers`. Bản WebP động đã chuyển ở `D:\Ami-Fat-Cat-Stickers\webp`; giữ nguyên GIF gốc, đối chiếu số khung hình từng file. Chưa nhập lên website do API `/api/v1/stickers` trả 404 khi kiểm tra ngày 2026-11-19.

## Triển khai

Cần cập nhật nhánh `giao-dien-moi` trên server, bao gồm mã nguồn backend, frontend và migration `20261119090627_sticker_library`, trước khi build.

Theo cấu hình deploy hiện tại, chạy tại `/opt/btt-chat-admin/deploy` sau khi cập nhật mã nguồn:

```sh
docker compose build backend web
docker compose run --rm backend ./node_modules/.bin/prisma migrate deploy
docker compose up -d backend web
```

Kiểm tra sau đăng nhập: `GET /api/v1/stickers` phải trả danh sách (có thể rỗng). Nếu trả “Cannot GET”, backend đang chạy chưa có controller sticker hoặc proxy trỏ nhầm phiên bản. Thiếu bảng dữ liệu thường gây lỗi server, không phải “Cannot GET”.

Gói cập nhật ngày 2026-11-20 nằm ở `out/sticker-update-20261120.zip`: giải nén vào thư mục gốc dự án trên server (đúng nơi chứa `backend`, `frontend`, `deploy`) trước các lệnh trên. Gói chỉ chứa mã nguồn chức năng sticker và tài liệu, không có `.env`, tài khoản hoặc mật khẩu. Sao lưu các file tương ứng trên server trước khi ghi đè nếu server có sửa riêng. Không cần tải thư mục ảnh lên server qua SFTP: sau khi API hoạt động, admin nhập WebP qua trang Kho sticker.

## Chuyển động và kiểm thử

Kho giữ WebP động. Tin gửi dùng GIF: Zalo upload/gif + media_type gif và kích thước; Messenger dùng file GIF với attachment loại image. Đây là ảnh động, không phải đăng ký bộ sticker chính thức trên nền tảng. Việc tự phát ảnh còn phụ thuộc ứng dụng phía người nhận.

Đã có test chuyển đổi khung hình/thời lượng/nền trong suốt và payload hai kênh; script `backend/scripts/smoke-stickers.ts` kiểm thử API trên server riêng (cần `SMOKE_CONFIRM=1`). Không dùng script này trên dữ liệu thật. Chưa thử gửi tin sang khách Zalo/Facebook thật.
