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
| Xin SĐT qua Zalo (thẻ `request_user_info`, sự kiện `user_submit_info` tự lưu số) | Chỉ test giả | Tên API/trường theo tài liệu, chưa kiểm chứng |
| Gửi ảnh (JPG/PNG ≤1 MB) / PDF (≤5 MB) sang Zalo | Chỉ test giả | `/v2.0/oa/upload/image|file`, chưa kiểm chứng |
| Thanh khung 48 giờ Zalo trong khung chat | Chỉ test giả | Tính từ `lastCustomerMessageAt` |
| Kênh kết nối: trạng thái token, hạn refresh token, tin gửi lỗi, cảnh báo | Chỉ test giả | Lỗi token và số tin lỗi giữ trong bộ nhớ, khởi động lại thì mất |
| Gợi ý trả lời bằng AI | Chưa làm | Cần gọi Gemini, chờ làm đợt sau |

## Digital (Nhu cầu tour)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Tự nhận địa điểm khách hỏi ("tour TQ" → Trung Quốc), 1 lượt/khách/địa điểm/ngày | Chỉ test giả | Cần migration `place_interests`. Chỉ tính tin MỚI từ lúc cập nhật, chưa quét tin cũ |
| Theo địa điểm: gộp nhãn sale ghim + khách tự hỏi | Chỉ test giả | |
| Tour chi tiết xếp theo doanh thu / số đơn chốt | Chỉ test giả | |

## Giao diện

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Chưa đọc đậm + chấm xanh, Liên hệ có chuông | Chỉ test giả | 2026-11-13 |
| Xoá hội thoại (admin) | Chỉ test giả | |
| Hộp thư theo bản Stitch: bộ lọc trạng thái vào nút Bộ lọc, cột danh sách 380px | Chỉ test giả | |
| Giao diện tối mới (than ấm, bỏ tông xanh tím) | Chỉ test giả | |

## Nhật ký

Mỗi dòng: ngày, việc, lệnh cập nhật VPS (ghi rõ có migration không).

- 2026-11-12: ảnh đại diện khách (**có migration** `20261112140000_customer_avatar`), nhập SĐT, nhập khách cũ. Bài học: luôn chạy `prisma migrate deploy` sau khi build.
- 2026-11-13 (4facaad): tin OA gửi, ảnh/PDF qua webhook, trích dẫn, cảm xúc; danh sách chưa đọc đậm hơn. Không có migration.
- 2026-11-13: kéo tin cũ tải ảnh/PDF, trích dẫn cho tin cũ và tin OA; thêm file này. Không có migration.

- 2026-11-13: Digital tự nhận địa điểm, xếp tour theo doanh thu/đơn chốt. **Có migration** `20261113090000_place_interests`.
- 2026-11-13: hộp thư theo Stitch, gửi ảnh/PDF và xin SĐT qua Zalo, trạng thái Zalo ở Kênh kết nối, giao diện tối mới. Không có migration mới (ngoài `place_interests` ở trên).

Lệnh cập nhật VPS chuẩn (migrate an toàn kể cả khi không có gì mới):

```
cd /opt/btt-chat-admin && git pull && cd deploy
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --build backend web
docker compose run --rm backend ./node_modules/.bin/prisma migrate deploy
docker compose restart backend
```
