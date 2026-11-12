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
- Chuyển sang Đã chốt qua hộp Chốt tour (`close`), vì đây là nguồn số doanh thu. Đổi ngày 2026-11-11: sale chỉ chọn tour, ngày khởi hành (mã đợt), số khách, voucher; **sale không sửa được giá**. Backend lấy giá/người của ngày khởi hành từ API tour, nhân số khách, trừ voucher (`tours/pricing.service.ts`). Tab "Theo mã đơn" xác nhận đúng đơn chatbot; đợt không còn trên website thì giữ giá/người lúc khách đặt. Mở lại hội thoại thì đơn bị đánh dấu `voidedAt`, không còn tính.

## Đơn đặt tour (chốt ngày 2026-11-06)
- Khách tự đặt qua chatbot: đơn **Chờ xác nhận** (`PENDING`), chưa tính doanh thu, hội thoại Chờ xử lý và được chia cho một sale. Sale gọi khách rồi **xác nhận đúng đơn đó** (sửa số người, tiền nếu khách đổi), không tạo đơn mới, để không tính doanh thu hai lần. Khách không đi nữa thì bấm Khách huỷ.
- BE Mobile báo booking `PAID` / `ONGOING` / `COMPLETED` thì đơn tự thành Đã chốt; `CANCELLED` / `REFUNDED` thì đơn huỷ dù sale đã chốt. Quy tắc ở `common/deals.ts`.
- Danh mục tour lấy từ API benthanhtourist.com qua backend, lưu tạm 1 giờ (`tours/tour-catalog.service.ts`, xem `docs/tour-api.md`). API không có tìm theo mã đợt nên backend tải chi tiết các tour cùng phần đầu mã rồi so đúng mã. Phần đầu mã như `A06.FIT.TW` không duy nhất, nên không dùng để nhận ra tour. Địa điểm của tour = thể loại ít tour nhất chứa nó.

## Voucher (chốt ngày 2026-11-11)
- Chỉ `ADMIN` và `DEPT_ADMIN` (admin chi nhánh) tạo, sửa, tạm khoá; admin phòng chỉ thấy voucher của phòng mình. Không xoá voucher. Sale nhập mã khi chốt, mã dùng được cho mọi sale.
- Hai loại: giảm số tiền, hoặc phần trăm có mức trần. Phạm vi: một tour, một địa điểm, mọi tour. Giảm **một lần trên tổng đơn**, không nhân theo khách, không quá tổng đơn (giả định, chưa hỏi lại chủ dự án). Quy tắc ở `common/vouchers.ts`.
- Số lần đã dùng đếm từ đơn `CONFIRMED` không `voidedAt`; mở lại hội thoại thì voucher được trả lượt. Chốt có voucher khoá theo voucher (`pg_advisory_xact_lock`) để không vượt số lần tối đa.

## Tour quan tâm (chốt ngày 2026-11-11)
- Cách gắn chính (đổi ngày 2026-11-11): bấm icon ghim trên từng tin trong khung chat, hộp hiện ra chỉ còn bước chọn tour (gõ tên hoặc mã). Tab Tour quan tâm chỉ xem lịch sử và gỡ nhãn, không còn nút gắn (đổi 2026-11-12).
- Sale gắn nhãn tour quan tâm ở cột thông tin khách, mỗi nhãn ghim đúng một tin (không ghim log nội bộ). Gắn theo **tour**, không theo ngày khởi hành. Cùng tour gắn lại sau là nhãn mới "Lần 2". Ai trong nhóm sale cũng gắn, gỡ được; có log nội bộ. Digital chỉ xem. Trang Nhu cầu tour chỉ đếm nhãn sale ghim, không đếm thẻ tour chatbot gửi (chốt 2026-11-11).

## Số điện thoại và chốt tour (chốt ngày 2026-11-12)
- **Chốt tour bắt buộc khách có số điện thoại** (backend trả `NEED_PHONE`). Khách Zalo không tự có số: sale xin khách rồi nhập ở menu ⋯ → "Cập nhật số điện thoại khách". Chốt khi chưa có số thì hộp hỏi số trước. Số đã thuộc khách khác thì từ chối, không tự gộp. Nhập sẽ ghi log nội bộ. Chưa làm nút xin số qua Zalo.

## Xoá hội thoại (chốt ngày 2026-11-12)
- Chỉ `ADMIN` toàn quyền, menu ⋯ trong khung chat, dùng dọn dữ liệu thử. Xoá hẳn hội thoại, tin nhắn, đơn, nhãn tour, file đính kèm; khách không còn hội thoại nào khác thì xoá luôn khách. Hội thoại có đơn đã chốt (đang tính doanh thu) phải xác nhận thêm vì doanh thu thống kê giảm theo. Có ghi log server.
- Đây là ngoại lệ của quy tắc "Lưu vĩnh viễn" bên dưới, chỉ do admin chủ động.

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
