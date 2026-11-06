# Quy tắc nghiệp vụ (chủ dự án đã chốt)

## Vai trò
- **Không có đăng ký công khai.** Chỉ `ADMIN` tạo tài khoản.
- `ADMIN` (đổi ngày 2026-11-06) dùng giao diện giống hệt sale (hội thoại, khách hàng, mẫu nhanh, nhắn tin), thêm 2 mục chỉ admin thấy: **Thống kê** và **Quản trị** (tạo tài khoản). Admin không được chia khách tự động và không có công tắc "Đang trực".
- `SALE` nhắn với khách, **không** xem được thống kê (backend trả 403, frontend ẩn mục). Mặc định route cho cả `SALE` và `ADMIN`; route chỉ admin phải ghi `@Roles(Role.ADMIN)`.
- Admin có thể khoá/mở khoá tài khoản và đặt lại mật khẩu. Khoá tài khoản ngắt socket, tắt đang trực và trả khách `CONTACT`/`PENDING` về hàng chờ chia lại. Admin không tự khoá, không khoá admin cuối cùng, không đặt mật khẩu cho admin khác.
- Admin đầu tiên tạo bằng `pnpm --filter backend create-admin <email> '<mật khẩu>'`. Mật khẩu không lưu trong `.env`.

## Trạng thái hội thoại
`CONTACT` Liên hệ (đỏ, gấp nhất, luôn ghim đầu), `UNREAD` Chưa xem, `READ` Đã xem, `PENDING` Chờ xử lý, `CLOSED` Đã chốt.

- Chỉ khi khách **muốn gặp nhân viên** mới ping lên admin. Câu như "nhân viên hướng dẫn có đi cùng không" không tính. Danh sách cụm từ ở `common/text.ts`, khớp với `TU_KHOA_CAN_NHAN_VIEN` của chatbot; chatbot có thể tự gửi cờ `wantsHuman`.
- Nhân viên trả lời xong thì Liên hệ chuyển thành Chờ xử lý.
- Chuyển sang Đã chốt phải nhập tour, **mã tour** (mã đợt khởi hành, ví dụ `A06.FIT.TW.070227.A`), số khách, tổng tiền (`close`), vì đây là nguồn số doanh thu. Mở lại hội thoại thì đơn bị đánh dấu `voidedAt`, không còn tính.

## Đơn đặt tour (chốt ngày 2026-11-06)
- Khách tự đặt qua chatbot: đơn **Chờ xác nhận** (`PENDING`), chưa tính doanh thu, hội thoại Chờ xử lý và được chia cho một sale. Sale gọi khách rồi **xác nhận đúng đơn đó** (sửa số người, tiền nếu khách đổi), không tạo đơn mới, để không tính doanh thu hai lần. Khách không đi nữa thì bấm Khách huỷ.
- BE Mobile báo booking `PAID` / `ONGOING` / `COMPLETED` thì đơn tự thành Đã chốt; `CANCELLED` / `REFUNDED` thì đơn huỷ dù sale đã chốt. Quy tắc ở `common/deals.ts`.
- Mã tour chỉ kiểm tra hình thức (chữ, số, dấu . - _, có ít nhất một số): API benthanhtourist.com không có tìm theo mã. Phần đầu mã như `A06.FIT.TW` không duy nhất, nên không dùng để nhận ra tour.

## Chia việc
Không có phân công tay. Khi khách đòi gặp nhân viên: khách cũ về người phụ trách cũ nếu đang trực; không thì người đang giữ ít khách nhất (`CONTACT` + `PENDING`), hoà thì người lâu chưa được chia. Sau `CONTACT_ACCEPT_MINUTES` chưa ai trả lời khách (bot vẫn chạy) thì tự chuyển người khác. Khách có đơn chờ xác nhận mà chưa ai phụ trách cũng được chia. Sale tắt "Đang trực" thì không nhận khách mới.

## Ai được nhắn (`common/locks.ts`, đổi ngày 2026-11-06)
Không còn khoá khung nhắn và các nút Tiếp quản, Nhận xử lý, Xử lý hộ, Lấy lại. Sale nào cũng nhắn được:

| Tình huống | Gửi tin thì |
|---|---|
| Chưa ai phụ trách | Người gửi nhận khách, bot dừng ("trả lời là nhận") |
| Đã chia cho người khác nhưng người đó chưa trả lời | Người trả lời trước nhận khách |
| Người khác đang phụ trách và đã trả lời | Tin ghi "Thảo (hỗ trợ Minh)", Minh vẫn phụ trách và được báo |
| Đồng nghiệp đang soạn (15 giây) hoặc vừa gửi (`COLLISION_WARN_SECONDS`) | Hỏi lại "Minh đang nhắn, vẫn gửi?", không chặn |

Mọi người thấy "Minh đang soạn tin" theo thời gian thực. Chuyển khách bằng nút "Chuyển cho đồng nghiệp", kèm ghi chú nội bộ; ai cũng chuyển được, log ghi ai chuyển. Chỉ người phụ trách trả lại cho bot được.

Log nội bộ chỉ admin (sale) thấy, khách không thấy. Tin nhân viên gửi làm bot và trả lời tự động dừng.

## Thông tin khách
- **App:** đã đăng nhập, lấy tên và SĐT từ tài khoản, không hỏi lại.
- **Web:** không đăng nhập, bot chào và **xin tên + SĐT trước rồi mới giải đáp**. Không cho thì nhắc: "cần họ tên và số điện thoại để thuận tiện cho việc tư vấn và liên hệ".
- **Cùng SĐT, tên gần giống** (Hoa, Nguyễn Hoa, Thị Hoa, Nguyễn Thị Hoa): nối tiếp, admin thấy một hội thoại duy nhất, lưu các cách viết vào `aliases`.
- **Cùng SĐT, tên khác hẳn:** yêu cầu nhập lại. Đây là đề xuất chờ chủ dự án xác nhận.
- **Máy khác** nhập trùng số: `loadHistory = false`, phía khách **không** tải tin cũ. Admin vẫn nối tiếp.
- SĐT web chưa có OTP nên hiện "Chưa xác minh".

## Lưu trữ
Tin nhắn trong database này **lưu vĩnh viễn**. Việc xoá sau 3 ngày chỉ là phía khách cho nhẹ.

## Trả lời tự động
Thứ tự: đòi gặp nhân viên, quy tắc tự động, rồi mới đến bot. Quy tắc gồm tin đầu tiên, theo từ khoá, ngoài giờ (không lặp trong 12 giờ). Dừng khi nhân viên đang xử lý hoặc đã tắt riêng cho khách đó.

## Thống kê
Khách, số điện thoại để lại, Liên hệ, đơn chốt, doanh thu theo kênh / tour / người chốt, 10 khách chi nhiều nhất, thời gian trả lời khách đòi gặp nhân viên (trung vị, tỷ lệ trong 5 phút, trung bình theo từng sale), chi phí Gemini quy ra tiền Việt. Kỳ: hôm nay, 7 ngày, tháng này, tất cả. Doanh thu và khách chi nhiều nhất chỉ cộng đơn Đã chốt (`CONFIRMED`, không `voidedAt`); đơn chờ xác nhận hiện riêng. Làm mới 5 phút, không cần thời gian thực. Google không có API trả số tiền theo key, nên chi phí = token ghi nhận × giá cấu hình, là số ước tính.
