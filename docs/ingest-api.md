# Hợp đồng API cho chatbot

Dành cho người nối chatbot bttAI (`D:\ChatBot`) và các kênh sau này vào trang quản trị.

- Gốc: `{BACKEND}/api/v1/ingest`
- Header bắt buộc: `x-ingest-key: <INGEST_API_KEY>`. Khoá này chỉ dùng giữa các máy chủ, **không đưa vào app hay trang web của khách**.
- `externalUserId`: id tài khoản NestJS với `APP`; mã ngẫu nhiên theo thiết bị với `WEB`.

## Luồng một câu của khách

```
Khách nhắn -> chatbot gọi POST /inbound
  action = BOT         chatbot tự trả lời như cũ, rồi gọi POST /bot-reply
  action = AUTO_REPLY  gửi `reply` cho khách, không gọi Gemini
  action = CONTACT     gửi `reply` cho khách ("đã báo nhân viên"), không gọi Gemini
  action = STAFF       nhân viên đang xử lý, chatbot im lặng
Client phía khách hỏi định kỳ qua chatbot -> GET /updates để nhận tin nhân viên
```

## POST /identify (web không đăng nhập)
Gọi khi khách nhập tên và số, trước khi chat.

```json
{ "channel": "WEB", "externalUserId": "uuid-thiet-bi", "name": "Nguyễn Thị Hoa", "phone": "0900 000 101" }
```

200: `{ "conversationId": "...", "returning": true, "loadHistory": false }`. Chỉ hiện lịch sử cũ khi `loadHistory = true` (đúng thiết bị cũ).

400 `INVALID_PHONE`; 409 `NAME_MISMATCH` kèm `message` để hiện cho khách.

## POST /inbound

```json
{
  "channel": "APP",
  "externalUserId": "id-tai-khoan",
  "text": "Cho tôi gặp nhân viên",
  "customer": { "name": "Nguyễn Thị Hoa", "phone": "0900000101" },
  "externalMessageId": "khong-bat-buoc-de-chong-trung",
  "wantsHuman": false,
  "interest": "Trung Quốc, dịp Tết"
}
```

200: `{ "conversationId": "...", "action": "BOT | AUTO_REPLY | CONTACT | STAFF", "reply": "..." }`.

`wantsHuman`: chatbot tự nhận ra khách cần người, ví dụ việc hoàn tiền của chính khách (`rag.hoi_muon_gap_nhan_vien`).

## POST /inbound-file (khách gửi ảnh hoặc PDF)
`multipart/form-data`: `channel`, `externalUserId`, `file` (bắt buộc); `text` (chữ kèm, không bắt buộc), `externalMessageId` (chống ghi trùng), `customer` (chuỗi JSON `{"name":...,"phone":...}`). Trả cùng dạng với `/inbound` (`action`: BOT, AUTO_REPLY, CONTACT, STAFF). Tin có thể không có chữ.

Backend nhận ra loại file theo nội dung (JPG, PNG, WebP, PDF; từ chối SVG, HTML, file đổi đuôi), ảnh tối đa 10 MB, PDF tối đa 20 MB, thu nhỏ ảnh về cạnh dài 1600 px và bỏ EXIF. File sai: `400` kèm `message` tiếng Việt để chatbot chuyển cho khách. Không có đường ghi thẳng database cho file: backend tắt thì chatbot báo khách "chưa gửi được ảnh".

## File đính kèm (nhân viên gửi và khách gửi)
- File lưu ở **Supabase Storage**, bucket **riêng tư** (`SUPABASE_BUCKET`). Bảng `messages` chỉ giữ đường dẫn (`attachmentPath`), loại, tên, dung lượng. Không lưu file trong database.
- Mọi API trả tin chỉ trả `attachment: { url, type, name, size }`, không bao giờ lộ `attachmentPath`.
- `GET /files/:messageId?exp=&sig=` (công khai, không cần đăng nhập): kiểm tra chữ ký HMAC gắn với đúng tin đó và hạn dùng, rồi chuyển hướng 302 tới link Storage sống 60 giây. Chữ ký sai, hết hạn, tin nội bộ hoặc không có file đều trả 404. Hạn link: 12 giờ cho nhân viên, 7 ngày cho khách.
- Ảnh khách gửi có thể chứa giấy tờ tuỳ thân: giao diện phía khách có dòng nhắc không gửi CCCD, hộ chiếu khi chưa cần.

## POST /bot-reply

```json
{
  "channel": "APP",
  "externalUserId": "id-tai-khoan",
  "text": "Câu trả lời của bot",
  "tours": [],
  "model": "gemini-3.1-flash-lite",
  "inputTokens": 1800,
  "outputTokens": 120
}
```

`tours` lấy nguyên từ `chuan_hoa_the_tour`. Số token lấy từ phản hồi của Gemini, là nguồn của số chi phí.

## POST /history
Chỉ ghi lại lịch sử, không báo nhân viên và không trả lời tự động: tin nhạy cảm chatbot đã chặn, nút khách bấm trong luồng đặt tour. Trùng `externalMessageId` thì bỏ qua.

```json
{
  "channel": "APP",
  "externalUserId": "id-tai-khoan",
  "customer": { "name": "Nguyễn Thị Hoa", "phone": "0900000101" },
  "messages": [{ "senderType": "CUSTOMER", "text": "Đồng ý", "externalMessageId": "uuid", "createdAt": "2026-11-05T08:00:00.000Z" }]
}
```

200: `{ "saved": 1 }`.

## Khi backend này không chạy
Chatbot ghi thẳng vào database ngay lúc khách chat (`D:\ChatBot\lich_su_db.py`), không chờ gửi bù. Khách đòi gặp nhân viên thì hội thoại thành `CONTACT` chưa có người, backend chạy lại thì bộ chia việc 30 giây tự chia.

## POST /usage
Lần gọi Gemini không gắn với câu trả lời nào, ví dụ tóm tắt: `{ "model": "...", "inputTokens": 0, "outputTokens": 0 }`.

## POST /deal
Khách tự đặt tour qua chatbot: `{ "channel": "APP", "externalUserId": "...", "tourName": "...", "guests": 2, "amount": 29980000, "orderCode": "<id booking>", "tourCode": "A06.FIT.TW.070227.A" }`. Gọi sau khi đơn tạo thành công, trùng `orderCode` thì bỏ qua.

Đơn ghi ở trạng thái **chờ xác nhận**, chưa tính doanh thu. Hội thoại chuyển Chờ xử lý và được chia cho một sale (như khách đòi gặp nhân viên). Sale gọi khách rồi bấm Xác nhận chốt, hoặc BE Mobile báo booking đã thanh toán qua `/booking-status`.

## POST /booking-status (BE Mobile gọi)
BE Mobile có thể gửi thêm `occurredAt` (ISO 8601) là thời điểm trạng thái đổi. Các lần gửi cũ hơn `bookingUpdatedAt` của đơn sẽ bị bỏ qua để tránh outbox giao lệch thứ tự.
`{ "orderCode": "<id booking>", "status": "PAID" }`, `status` là `BookingStatus` của BE Mobile. `PAID`, `ONGOING`, `COMPLETED` thì đơn thành Đã chốt; `CANCELLED`, `REFUNDED` thì đơn huỷ, không tính doanh thu; `PENDING`, `CONFIRMED` chỉ ghi lại. Booking không đặt qua chatbot trả `{ "matched": false }`. BE Mobile gọi ở `AdminChatNotifierService` (`D:\E-Commerce\Backend\e-commerce`), cấu hình `ADMIN_CHAT_URL`, `INGEST_API_KEY`.

## GET /updates?channel=&externalUserId=&after=
Tin nhân viên sau mốc `after` (ISO 8601). Không bao giờ chứa log nội bộ. Tin nhân viên trả lời trích một tin thì `text` có thêm dòng trích ở đầu (`“câu được trích”\n...`), vì app và web chưa có giao diện trích riêng.

Chỉ gọi khi khung chat phía khách đang mở: mỗi lần gọi được ghi là khách đã xem (`customerSeenAt`), trang quản trị hiện "Khách đã xem".

```json
{ "mode": "STAFF", "items": [{ "id": "...", "text": "...", "createdAt": "...", "attachment": { "url": "/files/<id>?exp=...&sig=...", "type": "image/jpeg", "name": "tour.jpg", "size": 123456 } }] }
```

`attachment` là `null` khi tin không có file; tin chỉ có file thì `text` rỗng. `url` là **đường dẫn tương đối**: nơi nhận thêm địa chỉ trang quản trị (chatbot dùng `ADMIN_CHAT_PUBLIC_URL`). Link sống 7 ngày và mở được không cần đăng nhập (xem mục "File đính kèm").

Thiết bị mới phải truyền `after` là thời điểm hiện tại để không đọc tin cũ của khách.
