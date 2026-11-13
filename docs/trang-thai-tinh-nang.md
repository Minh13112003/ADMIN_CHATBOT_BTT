# Trạng thái tính năng

Đọc file này đầu mỗi phiên, cập nhật cuối mỗi việc. Chỉ đổi sang **Đã chạy thật** khi chủ dự án xác nhận đã thử trên VPS.

- **Đã chạy thật**: chủ dự án đã thử trên https://chatadmin.benthanhtourist.com và thấy đúng.
- **Chỉ test giả**: có test đơn vị / dữ liệu giả, chưa thử với hệ thống thật (Zalo, Facebook...).
- **Chưa làm**.

## Zalo OA

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Lưu thông tin kết nối (mã hoá), nút Thay đổi | Đã chạy thật | |
| Webhook nhận tin chữ của khách | Đã chạy thật | Chữ ký kiểm bằng OA Secret Key hoặc khoá ứng dụng |
| Kết nối OAuth, tự làm mới token | Đã chạy thật | Làm mới mỗi 5 phút khi còn dưới 20 phút |
| Nhân viên trả lời từ trang này sang Zalo | Đã chạy thật | Chưa gửi được ảnh/PDF sang Zalo |
| Tên và ảnh đại diện khách | Đã chạy thật | Cần migration `customer_avatar` |
| Nhập SĐT, bắt buộc SĐT khi chốt tour | Chỉ test giả | |
| Nhập khách cũ từ Zalo | Đã chạy thật | Lần đầu lỗi do thiếu migration |
| Tin OA gửi trên ứng dụng Zalo (`oa_send_*`) | Chỉ test giả | Từ 2026-11-13. Tin trước giờ cập nhật VPS không về, phải Đồng bộ tin cũ |
| Ảnh/PDF/sticker khách gửi qua webhook | Chỉ test giả | Tên trường `message.attachments[].payload.url` chưa kiểm chứng |
| Ảnh/PDF khi kéo tin cũ, nâng cấp tin "xem trên Zalo OA" | Chỉ test giả | Tên trường link (`url`, `thumb`, `links`) chưa kiểm chứng; log "Lịch sử Zalo có tin loại..." |
| Trích dẫn (reply): webhook, tin OA, tin cũ | Chỉ test giả | Tên trường (`quote_msg_id`, `quote`...) chưa kiểm chứng; log "trường lạ trong message" |
| Khách thả cảm xúc → log nội bộ | Chỉ test giả | Tên sự kiện chưa kiểm chứng; log "Bỏ qua sự kiện Zalo" |
| Chatbot AI tự trả lời Zalo | Chưa làm | Đã có hướng (webhook gọi chatbot), chờ chủ dự án quyết |
| Xin SĐT qua Zalo (`request_user_info`) | Chưa làm | Chủ dự án bảo để sau |

## Giao diện

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Chưa đọc đậm + chấm xanh, Liên hệ có chuông | Chỉ test giả | 2026-11-13 |
| Xoá hội thoại (admin) | Chỉ test giả | |

## Nhật ký

Mỗi dòng: ngày, việc, lệnh cập nhật VPS (ghi rõ có migration không).

- 2026-11-12: ảnh đại diện khách (**có migration** `20261112140000_customer_avatar`), nhập SĐT, nhập khách cũ. Bài học: luôn chạy `prisma migrate deploy` sau khi build.
- 2026-11-13 (4facaad): tin OA gửi, ảnh/PDF qua webhook, trích dẫn, cảm xúc; danh sách chưa đọc đậm hơn. Không có migration.
- 2026-11-13: kéo tin cũ tải ảnh/PDF, trích dẫn cho tin cũ và tin OA; thêm file này. Không có migration.

Lệnh cập nhật VPS chuẩn (migrate an toàn kể cả khi không có gì mới):

```
cd /opt/btt-chat-admin && git pull && cd deploy
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --build backend web
docker compose run --rm backend ./node_modules/.bin/prisma migrate deploy
docker compose restart backend
```
