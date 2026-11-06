# Việc chưa làm

## Cần để chạy thật
- **Ảnh/PDF ở App Mobile và Zalo Mini App:** backend, trang quản trị, chatbot và web chat đã xong. Còn: app hiện ảnh/PDF nhân viên gửi (gọi `/chat/updates?tep=1`, đọc `attachment`), nút gửi ảnh từ app (`POST /chat/attachment`, multipart `file` + `message`), dòng nhắc không gửi giấy tờ tuỳ thân.
- Dọn file cũ trong Storage (đường dẫn theo tháng `YYYY-MM/`): chưa có việc tự xoá. Cần chốt thời hạn giữ file với công ty.
- Thông báo cho khách khi nhân viên nhắn lúc khung chat đang đóng (hiện lần mở sau mới thấy).
- Chọn nơi triển khai và tên miền, đặt `COOKIE_DOMAIN`.
- Xác nhận với công ty: giờ làm việc (`WORK_HOUR_*`), tỷ giá, nội dung quy tắc mặc định.

## Chờ chủ dự án quyết định
- Cùng SĐT, tên khác hẳn: đang yêu cầu nhập lại.
- Doanh thu Zalo, Facebook: đang để sale nhập khi chốt.
- Lưu vĩnh viễn tên và SĐT: nên hỏi pháp chế công ty, thêm câu thông báo ở khung chat web.

## Về sau
- Zalo OA, Facebook: skill `add-channel`.
- Phân quyền chi tiết hơn ngoài chức năng admin khoá/mở tài khoản và đặt lại mật khẩu.
- Chế độ tối.
