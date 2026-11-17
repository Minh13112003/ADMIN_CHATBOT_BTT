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
| Tin OA gửi trên ứng dụng Zalo (`oa_send_*`) | Không nhận được | 2026-11-13: OA gửi ảnh, sticker từ trang Zalo OA, máy chủ không nhận sự kiện nào (log "Tin OA gửi" trống). Tin khách gửi vẫn tới. Đang chờ chủ dự án kiểm tra danh sách sự kiện webhook trên developers.zalo.me |
| Sticker/ảnh động khách gửi | Chỉ test giả | Sticker tới ngay qua webhook (2026-11-13) nhưng đứng yên: nay giữ khung hình WebP động, nhận GIF từ Zalo |
| Ảnh/PDF/sticker khách gửi qua webhook | Chỉ test giả | Tên trường `message.attachments[].payload.url` chưa kiểm chứng |
| Ảnh/sticker khi kéo tin cũ | Đã kiểm chứng định dạng | Log thật 2026-11-13: `photo` có `thumb,url,description`; `sticker` có `url`; `link` có `links`. `nosupport` và tin không có `type` KHÔNG kèm nội dung (tệp PDF, tin thoại...): không lấy được, chỉ ghi dòng báo |
| Trích dẫn (reply) tin cũ | Không làm được | API lịch sử Zalo không trả thông tin trích dẫn |
| Trích dẫn (reply) qua webhook, tin OA | Chỉ test giả | Tên trường (`quote_msg_id`, `quote`...) chưa kiểm chứng; log "trường lạ trong message" |
| Khách thả cảm xúc → log nội bộ | Chỉ test giả | Tên sự kiện chưa kiểm chứng; log "Bỏ qua sự kiện Zalo" |
| Chatbot AI tự trả lời Zalo | Chưa làm | Đã có hướng (webhook gọi chatbot), chờ chủ dự án quyết |
| Xin SĐT qua Zalo bằng thẻ `request_user_info` | Đã bỏ nút | 2026-11-13: thẻ bắt quét QR trên Zalo PC, form nhiều ô. Chủ dự án chọn dùng mẫu trả lời nhanh "Xin số điện thoại" (phím tắt `sdt`, migration `20261113150000_mau_xin_sdt`). API và sự kiện `user_submit_info` còn trong backend, không có nút gọi |
| Gửi ảnh (JPG/PNG ≤1 MB) / PDF (≤5 MB) sang Zalo | Chỉ test giả | `/v2.0/oa/upload/image|file`, chưa kiểm chứng |
| Thanh khung 48 giờ Zalo trong khung chat | Chỉ test giả | Tính từ `lastCustomerMessageAt` |
| Kênh kết nối: trạng thái token, hạn refresh token, tin gửi lỗi, cảnh báo | Chỉ test giả | Lỗi token và số tin lỗi giữ trong bộ nhớ, khởi động lại thì mất |
| Gợi ý trả lời bằng AI | Chưa làm | Cần gọi Gemini, chờ làm đợt sau |

## Digital (Nhu cầu tour)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Tự nhận địa điểm khách hỏi ("tour TQ" → Trung Quốc), 1 lượt/khách/địa điểm/ngày | Chỉ test giả | Cần migration `place_interests`. Danh sách địa danh bổ sung từ `rules.py` chatbot (NZ, Maldives, Bắc Âu...) |
| Quét tin nhắn cũ (nút admin) và khi Đồng bộ tin cũ Zalo | Chỉ test giả | Theo ngày của từng tin |
| Theo địa điểm: lượt hỏi, % trên tổng, Xem thống kê ra từng tin nhắn | Chỉ test giả | Bỏ tour con (chủ dự án yêu cầu 2026-11-13) |
| Tour chi tiết xếp theo doanh thu / số đơn chốt | Chỉ test giả | |

## App Mobile (chuyển API từ backend e-commerce, xem docs/app-mobile-api.md)

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Đợt 1: đăng nhập SĐT, làm mới phiên, hồ sơ, đổi mật khẩu, PIN, lưu FCM token | Chỉ test giả | Cần migration `20261116090000_app_accounts`. App chưa sửa đường dẫn nên chưa thử được từ app |
| Sale tạo tài khoản / cấp lại mật khẩu ở menu ⋯ | Chỉ test giả | Cần khách có SĐT và đơn đã chốt |
| Lệnh `create-app-account` | Chỉ test giả | |
| Đợt 2: đặt tour từ app (đơn chờ xác nhận lên đầu hộp thư), lịch sử, số chỗ còn, ngày khởi hành, voucher chung | Chỉ test giả | Cần migration `20261116100000_app_bookings` |
| Trạng thái đơn app: Đã cọc / Đã thanh toán / Đã hoàn tiền (sale bấm ở cột Đơn tour), tự Đang đi tour / Hoàn thành, cộng điểm | Chỉ test giả | API thanh toán ghi ở roadmap "Việc còn nợ" |
| Voucher theo hạng thành viên + tối đa lượt/khách/tháng (trang Voucher, app chỉ hiện mã đúng hạng) | Chỉ test giả | Cần migration `20261116110000_app_phase3` |
| Chốt tour nhập người lớn / trẻ em (80%) / em bé (40%) | Chỉ test giả | Mọi đơn, không chỉ đơn app |
| Đợt 3: thông báo trong app, tour yêu thích, góp ý, ảnh đại diện (bỏ thân nhân) | Chỉ test giả | Cần migration `20261116110000_app_phase3` |
| Đợt 4: app trỏ backend mới, tour/tin/mẹo từ website, hạng theo điểm; chatbot đặt tour và đọc hồ sơ ở backend mới | Chỉ test giả | Chưa chạy app thật. Cần đặt `EXPO_PUBLIC_API_URL` (app) và `NESTJS_BASE_URL` (chatbot) là `https://chatadmin.benthanhtourist.com`. Zalo Mini App chưa sửa |

## Giao diện

| Tính năng | Trạng thái | Ghi chú |
|---|---|---|
| Chưa đọc đậm + chấm xanh, Liên hệ có chuông | Chỉ test giả | 2026-11-13 |
| Xoá hội thoại (admin) | Chỉ test giả | |
| Hộp thư theo bản Stitch: bộ lọc trạng thái vào nút Bộ lọc, cột danh sách 380px | Chỉ test giả | |
| Giao diện tối mới (than ấm, bỏ tông xanh tím) | Chỉ test giả | |
| Trang cá nhân `/profile`: đổi ảnh đại diện, họ tên, mật khẩu; xem mã NV, chức vụ, đơn vị | Chỉ test giả | Cần migration `20261117090000_user_avatar`. Cài đặt bỏ mục Phiên đăng nhập & Bảo mật |
| Kênh kết nối: "Khách nhắn hôm nay" (số hội thoại có tin khách từ 00:00 giờ VN) | Chỉ test giả | Trước tên là "Hội thoại có tin khách hôm nay" |
| Tin nhắn kiểu Zalo: ẩn giờ/icon, rê chuột (cả hàng ngang) hiện ghim + trả lời, bấm tin xem nền tảng và ngày giờ, mốc ngày giữa các ngày, ảnh/sticker gửi riêng không viền | Chỉ test giả | 2026-11-17, chưa mở trình duyệt kiểm tra |
| Thống kê mới theo Stitch: 5 mảng (Khách & Quan tâm, Tour, Hiệu suất sale, Doanh thu đã chốt, Kênh & Chi phí AI) + Nhu cầu tour; kỳ 7 ngày / 30 ngày (theo ngày), quý (13 tuần, theo tuần); biểu đồ đường, miền, cột, cột chồng, tròn, phễu, bản đồ nhiệt, bong bóng, phân tán, thác nước, tần suất | Chỉ test giả | 2026-11-17. API `GET /stats/board`. Đã chạy thử truy vấn (chỉ đọc), chưa mở trình duyệt. Bản đồ nhiệt dùng giờ khách đòi gặp nhân viên (không quét bảng messages) |

## Nhật ký

Mỗi dòng: ngày, việc, lệnh cập nhật VPS (ghi rõ có migration không).

- 2026-11-12: ảnh đại diện khách (**có migration** `20261112140000_customer_avatar`), nhập SĐT, nhập khách cũ. Bài học: luôn chạy `prisma migrate deploy` sau khi build.
- 2026-11-13 (4facaad): tin OA gửi, ảnh/PDF qua webhook, trích dẫn, cảm xúc; danh sách chưa đọc đậm hơn. Không có migration.
- 2026-11-13: kéo tin cũ tải ảnh/PDF, trích dẫn cho tin cũ và tin OA; thêm file này. Không có migration.

- 2026-11-13: Digital tự nhận địa điểm, xếp tour theo doanh thu/đơn chốt. **Có migration** `20261113090000_place_interests`.
- 2026-11-13: hộp thư theo Stitch, gửi ảnh/PDF và xin SĐT qua Zalo, trạng thái Zalo ở Kênh kết nối, giao diện tối mới. Không có migration mới (ngoài `place_interests` ở trên).
- 2026-11-13: tin cũ Zalo hiện "[OA gửi tin nhắn qua Zalo...]" (loại text, không chữ): nay tìm link ở mọi trường, tải tệp không lọc theo loại, log "Lịch sử Zalo tin không chữ". Không có migration. VPS build lỗi EOF do hết RAM (3,3 GB) và 47 GB bộ nhớ đệm build: dọn `docker builder prune -f`, build từng cái.
- 2026-11-13: bảng Theo địa điểm bỏ tour con, thêm % và hộp tin nhắn; quét tin cũ; thêm địa danh từ chatbot; khách chia sẻ số thì đẩy hội thoại lên đầu. Bỏ nút Xin số điện thoại, thay bằng mẫu trả lời nhanh. **Có migration** `20261113150000_mau_xin_sdt` (chỉ thêm 1 mẫu).
- 2026-11-16: Voucher theo hạng + lượt/tháng, chốt tour nhập người lớn/trẻ em/em bé, App Mobile đợt 3 (thông báo, yêu thích, góp ý, ảnh đại diện; bỏ thân nhân), sửa app và chatbot sang backend mới. **Có migration** `20261116110000_app_phase3`.
- 2026-11-16: App Mobile đợt 2 (đặt tour, trạng thái đơn, điểm thưởng 6 bậc, voucher chung, ngày khởi hành). **Có migration** `20261116100000_app_bookings`.
- 2026-11-16: App Mobile đợt 1 (tài khoản app, đăng nhập SĐT, hồ sơ, PIN; sale tạo tài khoản trong menu ⋯; lệnh create-app-account). **Có migration** `20261116090000_app_accounts`. Sticker WebP động, nhận GIF từ Zalo (không migration).
- 2026-11-13: danh sách hội thoại ghi người gửi tin cuối ("Bạn:", "Khách:", tên đồng nghiệp, "Zalo OA:"), đọc 1 dòng/hội thoại qua chỉ mục. Không có migration.
- 2026-11-13: hộp thống kê địa điểm thêm biểu đồ 7 ngày, tin nhắn dạng bảng 10 dòng/trang có nút số trang, bộ lọc kênh chỉ hiện kênh có tin. Chỉ frontend, không có migration.
- 2026-11-17: trang cá nhân (ảnh, họ tên, mật khẩu), form tạo tài khoản rộng hơn, bỏ Phiên đăng nhập trong Cài đặt, đổi tên "Khách nhắn hôm nay". **Có migration** `20261117090000_user_avatar`.
- 2026-11-17: tin nhắn kiểu Zalo (rê chuột, bấm xem chi tiết, mốc ngày). Chỉ frontend, không có migration.
- 2026-11-17: trang Thống kê làm lại theo thiết kế Stitch, API mới `GET /stats/board?range=7d|30d|quarter` (một lần gọi đủ 5 mảng, lưu tạm 5 phút); `/stats/orders` nhận thêm `range`. Không có migration.

Lệnh cập nhật VPS chuẩn (migrate an toàn kể cả khi không có gì mới):

```
cd /opt/btt-chat-admin && git pull && cd deploy
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d --build backend web
docker compose run --rm backend ./node_modules/.bin/prisma migrate deploy
docker compose restart backend
```
