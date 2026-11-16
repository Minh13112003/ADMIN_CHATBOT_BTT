# API cho app Mobile (chuyển từ backend e-commerce)

Chủ dự án chốt 2026-11-16: chuyển các API mà app Mobile (`D:\App Mobile\MyFirstApp`) đang dùng từ backend cũ
(`D:\E-Commerce\Backend\e-commerce`) sang backend này, **không chuyển dữ liệu cũ**, chỉ lấy trường và API app cần.

## Quyết định

- Gộp vào backend hiện tại, đường dẫn `/api/v1/app/...` (trang quản trị đã dùng `/auth`, `/users`). App phải đổi đường dẫn.
- **Không có đăng ký trong app.** Sale tạo tài khoản ở menu ⋯ → "Tài khoản app của khách", chỉ khi khách đã có SĐT và có đơn đã chốt.
  Tên đăng nhập = SĐT, mật khẩu ngẫu nhiên 6 ký tự (hoa, thường, số), chỉ hiện cho sale một lần. Cấp lại mật khẩu thì máy đang đăng nhập bị đăng xuất.
- Tài khoản app nối với khách chat qua `app_accounts.customerId` (một khách một tài khoản). Tên khách nằm ở `customers.name`.
- Tour hot/mới/phổ biến/theo loại, tin tức, mẹo du lịch: app lấy thẳng từ benthanhtourist.com (app đã có hàm gọi website), không chuyển bảng.
- Token app ký bằng khoá riêng (`JWT_SECRET` + hậu tố), tách khỏi cookie nhân viên. Access 15 phút, refresh 30 ngày, refresh dùng một lần (băm SHA-256, không dùng bcrypt vì bcrypt chỉ đọc 72 byte đầu).
- Tạo tài khoản bằng lệnh (không cần đơn chốt): `pnpm --filter backend create-app-account <SĐT> '<mật khẩu>' ["Họ tên"]`.

## Bản đồ API

| App gọi (cũ) | Mới | Đợt | Trạng thái |
|---|---|---|---|
| `POST /auth/login` `{identifier, password}` | `POST /app/auth/login` | 1 | Xong |
| `POST /auth/refresh-token` (Bearer refresh) | `POST /app/auth/refresh-token` | 1 | Xong |
| `POST /auth/logout` | `POST /app/auth/logout` | 1 | Xong |
| `POST /auth/register` | Bỏ (sale tạo tài khoản) | 1 | Xong |
| `GET/PATCH /users/me`, `PATCH /users/me/password` | `/app/users/me`, `/app/users/me/password` | 1 | Xong |
| `GET /users/me/pin-status`, `POST /users/me/pin`, `POST /users/me/pin/verify`, `PATCH /users/me/pin` | `/app/users/me/...` | 1 | Xong |
| `POST /users/me/fcm-token` | `/app/users/me/fcm-token` | 1 | Xong (chỉ lưu token, chưa gửi thông báo đẩy) |
| `POST /bookings`, `GET /bookings/me`, `GET /bookings/:id`, `GET /bookings/laravel-seats` | `/app/bookings...` | 2 | Xong. Giá lấy từ website, không tin giá app gửi. `bookings/me` trả `{items, meta}` như app cũ. `id` đơn cũng là `orderCode` để chatbot đặt hộ không tạo đơn trùng |
| `GET /vouchers` | `/app/vouchers` | 2 | Xong, cần đăng nhập. Dùng chung voucher trang Voucher, chỉ mã khách đang dùng được (đúng hạng, chưa hết lượt tháng), trả `{items, meta}` |
| `GET /departures/tour/:id` | `/app/departures/tour/:tourKey` | 2 | Xong, ngày khởi hành từ website kèm số chỗ còn |
| `GET /notifications`, `unread-count`, `read-all`, `:id/read` | `/app/notifications...` | 3 | Xong. Tạo khi đơn đổi trạng thái (xác nhận, cọc, thanh toán, đi tour, hoàn thành, huỷ, hoàn tiền). Chưa có thông báo đẩy |
| `GET/POST/PATCH/DELETE /relatives` | Bỏ (chủ dự án bỏ thân nhân 2026-11-16) | 3 | Xong |
| `GET /favorites/me`, `GET/DELETE /favorites/:tourKey`, `POST /favorites` | `/app/favorites...` | 3 | Xong |
| `POST /feedbacks` | `/app/feedbacks` | 3 | Xong. Lưu bảng `app_feedbacks` và ghi log nội bộ vào hội thoại app của khách |
| `PATCH /users/me/avatar` | `/app/users/me/avatar` | 3 | Xong. Ảnh lưu chung chỗ file đính kèm, xem qua link ký có hạn `/app/avatar/:id` |
| `GET /users/referral` | Bỏ (chủ dự án bỏ mã giới thiệu 2026-11-16) | 3 | Xong |
| `GET /tours/*`, `GET /news*`, `GET /travel-tips*` | Bỏ, app lấy từ website | 4 | Đã sửa app (mẹo du lịch = blog "Cẩm nang du lịch") |

Đợt 4 (đã sửa code 2026-11-16, chưa chạy thử trên máy thật):
- App (`D:\App Mobile\MyFirstApp`): `services/api/constants.ts` trỏ `/api/v1/app/...`, làm mới phiên ở `/api/v1/app/auth/refresh-token`. Đặt `EXPO_PUBLIC_API_URL` là tên miền trang quản trị (ví dụ `https://chatadmin.benthanhtourist.com`). Tour, tin tức, mẹo du lịch lấy từ website. Ngưỡng hạng đổi sang điểm. Thêm trạng thái "Đã cọc". Màn đăng ký, thân nhân, mã giới thiệu đã không còn trong giao diện.
- Chatbot (`D:\ChatBot`): `main.py` gọi `/api/v1/app/users/me` (dùng `fullName`), `dat_tour.py` đặt tour qua `/api/v1/app/bookings`. Biến `NESTJS_BASE_URL` giữ tên, đặt thành gốc trang quản trị. `sync_tours.py` không còn lấy được thể loại tour (backend mới không có `/tours` công khai), đồng bộ vẫn chạy với thể loại rỗng.
- Zalo Mini App chưa sửa, vẫn trỏ backend cũ.

## Đơn đặt tour từ app (chốt 2026-11-16)

Đơn là một dòng `deals` nguồn `APP`, hành khách ở `deal_guests`. Khách đặt thì hội thoại kênh APP lên đầu hộp thư, trạng thái Chờ xử lý, chia sale, báo nhân viên (`contact:new` kind BOOKING). Trạng thái khách thấy là `deals.bookingStatus` (`common/app-booking.ts`):

| Mã | Tên | Ai đổi |
|---|---|---|
| PENDING | Chờ xác nhận | Khách đặt |
| CONFIRMED | Đã xác nhận | Sale bấm Xác nhận chốt (tính doanh thu) |
| DEPOSITED | Đã cọc | Sale bấm khi khách chuyển cọc 50%. Sau này API thanh toán tự đổi (xem roadmap) |
| PAID | Đã thanh toán | Sale bấm |
| ONGOING | Đang đi tour | Máy tự đổi mỗi giờ khi tới ngày khởi hành (cả đơn chưa cọc) |
| COMPLETED | Hoàn thành | Máy tự đổi sau ngày về, cộng điểm |
| CANCELLED | Đã huỷ | Sale bấm Khách huỷ |
| REFUNDED | Đã hoàn tiền | Sale bấm, đơn thôi tính doanh thu |

Giá: người lớn 100%, trẻ em 80%, em bé 40%. Khi chốt, sale nhập được số người lớn, trẻ em, em bé (mọi đơn, không chỉ đơn app). Điểm thưởng chỉ để xét bậc (không trừ tiền): 1.000 đ = 1 điểm trên số tiền sau voucher, cộng một lần khi Hoàn thành. 6 bậc: Đồng 0, Bạc 10.000, Vàng 50.000, Bạch Kim 100.000, Kim Cương 200.000, Ruby 500.000 điểm. App cần đổi ngưỡng bậc (bản cũ tính theo đồng) ở đợt 4.

## Voucher theo hạng (chốt 2026-11-16)

- `vouchers.tier`: chỉ khách có tài khoản app đang **đúng** hạng đó dùng được (không dùng cho hạng cao hơn hay thấp hơn, theo điều khoản app). Bỏ trống = mọi khách.
- `vouchers.maxUsesPerCustomerMonth`: mỗi khách tối đa N lần một tháng (giờ Việt Nam). Đếm đơn đã chốt trong tháng cộng đơn app đang chờ xác nhận (giữ lượt).
- App chỉ hiện voucher khách đang dùng được. Sale chốt đơn có voucher theo hạng thì backend kiểm hạng của khách (khách chưa có tài khoản app thì không có hạng). Chốt và đặt tour khoá theo voucher rồi đếm lại để không vượt lượt.

## Câu hỏi còn mở

- Thông báo đẩy Firebase và ảnh đại diện (bản cũ dùng Cloudinary): cần khoá Firebase; ảnh đại diện lưu chung chỗ với file đính kèm.
- Voucher theo hạng (BTTRANKGOLD5...): admin tự tạo ở trang Voucher (chọn "Chỉ hạng Vàng", "Mỗi khách tối đa N lần/tháng"). Số lần mỗi hạng trong điều khoản app (3, 4, 5, 6 lần/tháng) là chữ cũ đổi từ "năm" sang "tháng", cần chủ dự án xác nhận.
