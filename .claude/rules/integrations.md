# Tích hợp bên ngoài

Trạng thái ngày 2026-11-06. Cập nhật file này mỗi khi trạng thái đổi.

| Kênh | Trạng thái | Ghi chú |
|---|---|---|
| bttAI App, Web, Zalo Mini App | **Đã nối** (chạy trên máy, chưa triển khai server) | Hợp đồng ở `docs/ingest-api.md`. Mini App đi chung kênh `APP` vì dùng cùng tài khoản |
| Zalo OA | Để ngỏ theo yêu cầu | Enum `ZALO`, `CustomerIdentity` đã sẵn; nút lọc đang khoá (`connected: false` trong `labels.ts`) |
| Facebook | Để ngỏ theo yêu cầu | Tương tự Zalo |

## Phía chatbot đã nối thế nào (`D:\ChatBot`)
- `admin_chat.py` gọi `/ingest`. Cấu hình `ADMIN_CHAT_URL`, `INGEST_API_KEY` trong `.env` chatbot; khoá phải trùng bên này.
- Backend trang quản trị ngừng chạy thì chatbot vẫn trả lời khách (đòi gặp người thì quay về link Zalo) và **ghi thẳng vào database ngay lúc đó** bằng `lich_su_db.py`, qua `ADMIN_DATABASE_URL` trong `.env` chatbot. Không có hàng chờ gửi bù. Khách đòi gặp người thì hội thoại thành `CONTACT` chưa có người, `chiaLai` tự chia khi backend chạy lại. Sau một lần không kết nối được, 15 giây tiếp theo đi thẳng database. Chỉ mất tin khi cả backend lẫn database đều hỏng.
- Tin nhạy cảm bị chặn và nút bấm đặt tour được lưu qua `POST /ingest/history` (chỉ ghi lại, không chạy quy tắc), hỏng thì cũng ghi thẳng. Tin rỗng, quá dài, quá giới hạn tốc độ khi đang chat với bot thì không lưu.
- Giới hạn tốc độ theo khách (2 giây mỗi câu, 6 câu mỗi phút...) không chặn tin khi nhân viên đang xử lý: chạm giới hạn thì chatbot hỏi chế độ hội thoại, `STAFF` thì tin vẫn tới nhân viên. Tin vượt giới hạn không bao giờ gọi Gemini. Giới hạn theo IP ở `/web/chat` (20 câu mỗi phút) vẫn giữ.
- **Đổi bảng `customers`, `customer_identities`, `conversations`, `messages`, `deals`, `ai_usage` thì phải sửa `D:\ChatBot\lich_su_db.py` theo**, vì file đó viết SQL tay. Các hàm tên, SĐT ở đó chép từ `common/text.ts`, sửa bên này thì sửa cả bên kia. `customers.searchText` và `conversations.lastCustomerMessageAt` do trigger trong database điền, chatbot không cần ghi. Đơn chatbot ghi thẳng không đặt `status`, `source`: mặc định của database là chờ xác nhận, `CHATBOT`. Các cột mới của `deals` (`tourKey`, `unitPrice`, `subtotal`, `voucherId`, `discount`, `departureDate`, thêm ngày 2026-11-11) đều cho phép trống nên `lich_su_db.py` chưa cần sửa.
- Đơn khách tự đặt: `dat_tour.py` gửi kèm `tourCode` (mã đợt `tour_days[].code`) và `orderCode` là id booking BE Mobile.
- **BE Mobile** (`D:\E-Commerce\Backend\e-commerce`) ghi trạng thái booking vào bảng `admin_chat_outbox` cùng giao dịch đổi trạng thái, rồi cron gửi qua `POST /ingest/booking-status`. Lỗi mạng được thử lại theo giãn cách tăng dần tối đa khoảng 3 ngày; `occurredAt` giúp trang quản trị bỏ cập nhật cũ giao lệch thứ tự. Migration `20261106070744_admin_chat_outbox` đã tạo, cần triển khai cùng mã BE Mobile.
- **Ảnh, PDF** (từ 2026-11-06): nhân viên gửi qua `POST /conversations/:id/messages/file`; khách gửi qua chatbot `POST /chat/attachment` (app) và `POST /web/attachment` (web), chatbot chuyển tiếp `POST /ingest/inbound-file`. Bot không xem được ảnh nên trả lời cố định; nhân viên đang xử lý thì im. Chatbot lấy link file ở `/ingest/updates` rồi thêm `ADMIN_CHAT_PUBLIC_URL`. `/chat/updates?tep=1` trả `attachment` riêng; không có `tep` (app cũ) thì link nằm trong chữ để vẫn mở được. Web chat đã hiện và gửi được file. **App Mobile và Mini App chưa có giao diện gửi/hiện file** (xem `docs/roadmap.md`).
- App và Mini App: `POST /chat`, lấy tin nhân viên qua `GET /chat/updates` mỗi 5 giây khi khung chat đang mở. Tên, SĐT lấy từ `/users/me` của backend e-commerce; chatbot chỉ giữ 2 trường này, không giữ CCCD, hộ chiếu.
- Web (`static/chat.html`, không đăng nhập): `POST /web/identify`, `POST /web/chat`, `GET /web/updates`. API công khai nên có giới hạn theo IP. `/web/chat` từ chối ở máy chủ khi chưa có tên + SĐT. `web_khach.doc_tu` chặn máy khác lùi mốc để đọc tin cũ. Khách web chưa đặt tour trong khung chat vì luồng đặt cần token tài khoản.
- Khách đóng hẳn khung chat thì chưa có thông báo tin nhân viên, lần mở sau mới thấy.

## Ghi chú nghiên cứu Zalo OA (cần xác minh khi làm)
- API cần OA đã xác thực và gói Tăng trưởng trở lên (2,5 triệu/năm).
- Tin tư vấn miễn phí trong 48 giờ từ tương tác cuối, ngoài khung trừ hạn mức gói rồi tính 55 đ/tin.
- OpenAPI chỉ gửi được trong 7 ngày từ tương tác cuối; Trang Quản lý OA được 365 ngày.
- Tên API lấy từ SDK bên thứ ba, chưa đối chiếu tài liệu chính thức: webhook `user_send_text`, `oa_send_text`; gửi `POST /v3.0/oa/message/cs`; `quota/message`; mẫu `request_user_info`.

## Ghi chú nghiên cứu Facebook
Miễn phí, không cần App Review nếu chỉ dùng cho Page của công ty. Trả lời trong 24 giờ, nhân viên có thêm khung 7 ngày. Handover Protocol đã bỏ, dùng Conversation Routing. Không có sự kiện chung báo khách đòi gặp người, phải tự đọc nội dung tin.

## Gemini
Giá nhập trong `.env` (`GEMINI_PRICE_*`), tỷ giá `USD_VND_RATE`. Chatbot phải gửi số token từ mỗi phản hồi thì mới có số chi phí.
