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

## Tệp sticker (2026-11-20)

- Admin tạo **tệp** (bộ) ở trang Kho sticker, chọn "Tải vào tệp" trước khi tải file. Mỗi sticker có ô chọn để chuyển sang tệp khác. Đổi tên, ẩn, hiện lại tệp được; ẩn tệp thì sale không thấy sticker trong tệp.
- Bảng chọn trong chat có tab: Gần đây, Tất cả (chia mục theo tệp), từng tệp, và "Khác" cho sticker chưa xếp tệp. Tìm kiếm tìm trên mọi tệp.
- API: `GET /stickers/packs` (`?all=1` có cả tệp ẩn), `POST /stickers/packs`, `PATCH /stickers/packs/:id` (chỉ admin), `POST /stickers` nhận thêm `packId`, `PATCH /stickers/:id/pack`.

## Gửi sang Zalo (sửa 2026-11-20)

- Lần chạy thật đầu tiên Zalo trả `-200 Send message failed` ở bước gửi tin GIF (bước tải GIF lên vẫn qua).
- Theo SDK chính thức `zaloplatform/zalo-php-sdk` (`MessageBuilder`, loại `media`, `media_type: gif`): tin luôn có trường `text` (rỗng cũng gửi), phần tử có `width`, `height`, `attachment_id`; ví dụ GIF của SDK gửi qua **API v2.0** `/v2.0/oa/message`, còn các ví dụ v3 `/v3.0/oa/message/cs` không có GIF. Trang developers.zalo.me không đọc được bằng công cụ nên chưa đối chiếu tài liệu gốc.
- Code giờ thử lần lượt: v3 `/cs` có `text`, rồi v2.0 `/oa/message`. Cả hai bị từ chối thì gửi **khung đầu dạng PNG** qua đường gửi ảnh thường (khách vẫn thấy sticker nhưng đứng yên), log backend ghi "Zalo không nhận ảnh động, gửi ảnh tĩnh thay thế" kèm lý do. Chưa thử lại trên Zalo thật.
- **Lần 2 (2026-11-20):** sau khi triển khai, cả v3 lẫn v2.0 vẫn trả -200. Nghiên cứu thêm: v2.0 `/oa/message` đã ngừng hỗ trợ từ 20/06/2023 (mục "v2 dừng hỗ trợ" trên developers.zalo.me); các thư viện v3 (`@warriorteam/redai-zalo-sdk`, `Firef0x/chat-adapter-zalo-oa`) **bỏ hẳn `text`** khi không có chữ, `width`/`height` là số, có thể dùng `url` (GIF tối đa 1 MB) thay `attachment_id`; mã tải lên giữ tối đa 7 ngày. Không tìm thấy ai xác nhận đã gửi GIF chạy thật. Code giờ chỉ dùng v3 `/cs`, tin GIF không có `text` (chữ sale gõ gửi thành tin riêng sau ảnh), thử `attachment_id` rồi `url` = `<FRONTEND_URL>/api/v1/stickers/:id/gif?exp&sig` (route công khai, chữ ký HMAC bằng `JWT_SECRET`, hạn 1 giờ). Log ghi "Zalo nhận ảnh động (cách ...)" khi được, hoặc lý do từng cách khi phải gửi PNG tĩnh. Nếu vẫn -200 thì nhiều khả năng Zalo không còn hiển thị GIF trong tin tư vấn 1-1; hướng còn lại là sticker có sẵn của Zalo (`media_type: sticker` + mã sticker Zalo), không dùng được ảnh riêng.
- File WebP trong `D:\Ami-Fat-Cat-Stickers\webp` là ảnh động thật (kiểm tra 2026-11-20: 8 đến 20 khung, lặp vô hạn, cùng số khung với GIF gốc). Gửi tay trong ứng dụng Zalo mà thành ảnh tĩnh là do ứng dụng Zalo xử lý ảnh lúc gửi, không phải file hỏng; trang quản trị không gửi WebP sang Zalo mà gửi bản GIF.

## Chuyển động và kiểm thử

Kho giữ WebP động. Tin gửi dùng GIF: Zalo upload/gif + media_type gif và kích thước; Messenger dùng file GIF với attachment loại image. Đây là ảnh động, không phải đăng ký bộ sticker chính thức trên nền tảng. Việc tự phát ảnh còn phụ thuộc ứng dụng phía người nhận.

Đã có test chuyển đổi khung hình/thời lượng/nền trong suốt và payload hai kênh; script `backend/scripts/smoke-stickers.ts` kiểm thử API trên server riêng (cần `SMOKE_CONFIRM=1`). Không dùng script này trên dữ liệu thật. Chưa thử gửi tin sang khách Zalo/Facebook thật.
