# Việc chưa làm

## Cần để chạy thật
- **Ảnh/PDF ở App Mobile và Zalo Mini App:** backend, trang quản trị, chatbot và web chat đã xong. Còn: app hiện ảnh/PDF nhân viên gửi (gọi `/chat/updates?tep=1`, đọc `attachment`), nút gửi ảnh từ app (`POST /chat/attachment`, multipart `file` + `message`), dòng nhắc không gửi giấy tờ tuỳ thân.
- Dọn file cũ trong Storage (đường dẫn theo tháng `YYYY-MM/`): chưa có việc tự xoá. Cần chốt thời hạn giữ file với công ty.
- Thông báo cho khách khi nhân viên nhắn lúc khung chat đang đóng (hiện lần mở sau mới thấy).
- Chọn nơi triển khai và tên miền, đặt `COOKIE_DOMAIN`.
- Xác nhận với công ty: giờ làm việc (`WORK_HOUR_*`), tỷ giá, nội dung quy tắc mặc định.

## Việc còn nợ: thanh toán (chủ dự án ghi 2026-11-16)
- Tích hợp API thanh toán: khách chốt tour xong chuyển khoản cọc 50%. Hiện sale tự bấm "Đã cọc" / "Đã thanh toán" ở đơn đặt từ app (cột Đơn tour). Khi có API thì đơn tự chuyển Đã cọc khi nhận tiền cọc, Đã thanh toán khi đủ tiền.
- Thông báo đẩy Firebase cho app (chủ dự án để sau): backend đã lưu `app_accounts.fcmToken`, chưa gửi.

## Chờ chủ dự án quyết định
- Cùng SĐT, tên khác hẳn: đang yêu cầu nhập lại.
- Doanh thu Zalo, Facebook: đang để sale nhập khi chốt.
- Lưu vĩnh viễn tên và SĐT: nên hỏi pháp chế công ty, thêm câu thông báo ở khung chat web.


## Nhu cầu tour (Digital): còn lại

- Đã làm (11/11/2026): chỉ đếm tour sale ghim (đã bỏ thẻ tour chatbot gửi vì bot gợi ý không đúng ý khách), tab Theo địa điểm / Theo tour chi tiết, hộp "Thống kê tour" theo Stitch "Nhu cầu tour (Digital) — Chi tiết tour & Modal Thống kê tour". Gộp theo tên tour bỏ dấu; địa điểm lấy từ danh mục website, không có thì đoán từ tên ("Du Lịch Trung Quốc: ...").
- Các câu SQL của trang này (gộp 2 nguồn, biểu đồ 7 ngày, top sale gắn) chưa chạy trên database thật, cần thử sau khi triển khai.
- Đơn "Đã chốt" của một tour đếm theo tên tour trùng khớp; đơn nhập tên khác (đơn cũ nhập tay) không được tính.
- Mẫu tour trong ô trả lời nhanh (tab "Tour") để sau.

## Để sau: tour riêng của phòng Inbound

Chủ dự án xác nhận 11/11/2026: Inbound sẽ có tour riêng, không có trên benthanhtourist.com. Hiện hộp Chốt tour chỉ chốt được tour có trên website (giá lấy từ API). Tạm thời chỉ tách 2 vai trò / phòng (FIT, Inbound), cách chốt tour riêng của Inbound (nguồn danh mục, ai nhập giá) chủ dự án sẽ nói chi tiết sau. Chưa làm gì thêm cho tới lúc đó.

## Nợ: nhận diện khách quan tâm tour từ tin Zalo và Facebook (chờ tích hợp)
- **Chờ:** chủ dự án nối Zalo OA và Facebook (skill `add-channel`) rồi đổ dữ liệu về để thử. Chưa làm gì trong lúc chờ.
- **Vì sao cần:** Zalo và Facebook chỉ có sale nhắn tay, không có bttAI nên không có thẻ tour. Trang Nhu cầu tour (`/tour-interest`) hiện chỉ đếm theo thẻ tour bot gửi (Web, App), nên khách hỏi trên Zalo/Facebook chưa hiện.
- **Việc phải làm:** bảng sự kiện "khách quan tâm tour" ghi lúc tin về (nguồn: thẻ / từ khoá / AI, độ chắc chắn, mã tin); nhận diện từ khoá trong tin khách theo danh mục tour; Digital đánh dấu tour chiến dịch (ví dụ Thái Lan mới) và khai báo cách gọi khác; sau cùng mới tính AI đọc ngữ cảnh.
- **Danh mục tour:** lấy từ API benthanhtourist.com. Có mã tour và ngày khởi hành, **không có ngày đăng**, nên "tour mới" phải tính theo lần đầu tour xuất hiện hoặc do Digital đánh dấu tay.
- **Quy tắc:** tin chung chung ("muốn đi Thái Lan") không gán cho tour cụ thể, chỉ ghi ở mục quan tâm điểm đến. Nhận diện không chắc thì hiện "có thể quan tâm" cho Digital duyệt.
- **Lưu ý khi chạy quảng cáo:** Zalo và Facebook giới hạn gửi tin chủ động ngoài khung thời gian hoặc khi khách chưa đồng ý; chưa có SĐT thì chưa chạy theo số.
- **Đã xong từ trước:** giao diện danh sách khách, đoạn tin, mở tin nhắn gốc ở tab mới (`/inbox?c=&m=`), phạm vi theo phòng ban.

## Nợ: nối Facebook Messenger (chủ dự án để mai làm, ghi 2026-11-17)
- **Đang kẹt ở bước 1:** chủ dự án đăng ký tài khoản Meta for Developers (developers.facebook.com) nhưng bước nhập email báo "Không thể gửi email. Vui lòng thử lại sau" với mọi email (máy chủ Facebook trả `success: false`). Nghi tài khoản bị tạm chặn gửi mã vì bấm gửi lại mã OTP 2-3 lần. Hướng xử lý: chờ khoảng 24 giờ rồi thử lại, chỉ bấm gửi một lần; không được thì nhờ đồng nghiệp tạo ứng dụng rồi thêm chủ dự án làm admin ứng dụng; đã soạn sẵn nội dung gửi báo cáo cho Meta.
- **Các bước còn lại:** tạo ứng dụng loại Business có sản phẩm Messenger; lấy ID Trang, App Secret, Page access token; nhập ở trang Kênh kết nối (đã có ô nhập, lưu mã hoá); khai báo webhook sau khi máy chủ có phần nhận tin; nhắn thử bằng tài khoản có vai trò trong ứng dụng; chuyển ứng dụng sang chế độ Live cho khách thật (có thể phải qua Meta duyệt quyền và xác minh doanh nghiệp, chưa kiểm chứng tài liệu chính thức).
- **Cập nhật 2026-11-18:** chủ dự án đã nối thành công ở chế độ thử (token từ tài khoản có toàn quyền Trang). Còn: gửi **Xét duyệt ứng dụng** cho `pages_messaging` và `pages_manage_metadata` (cần video quay màn hình, mô tả cách dùng, link chính sách quyền riêng tư; có thể bị đòi xác minh doanh nghiệp), chuyển ứng dụng sang Live, và thay token bằng token Người dùng hệ thống (xem Lưu ý trước khi bàn giao).
- **Còn lại sau khi chạy thật:** thẻ `HUMAN_AGENT` để nhân viên trả lời trong 7 ngày (cần Meta duyệt); chatbot bttAI trả lời trên Messenger.

## Về sau
- Zalo OA, Facebook: skill `add-channel`.
- Phân quyền chi tiết hơn ngoài chức năng admin khoá/mở tài khoản và đặt lại mật khẩu.
- Chế độ tối.
