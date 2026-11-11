# Admin Digital — Nhu cầu tour

Thiết kế trên Stitch, chưa triển khai mã ứng dụng hoặc thay đổi quyền tài khoản.
Project: https://stitch.withgoogle.com/projects/5451236824423667128

## Luồng chính

1. Tổng quan hiển thị đúng top 10 tour theo số khách duy nhất đã hỏi, kèm giá bán/người, mã tour, ngày đăng và số lượt hỏi.
2. Phóng to mở danh sách đầy đủ mọi tour từng được hỏi trong phạm vi được cấp quyền. Mặc định từ trước đến nay, phân trang 25 dòng; không giới hạn tìm kiếm trong top 10.
3. Tìm tên/mã tour không phân biệt hoa thường, dấu tiếng Việt; kết quả giữ thứ hạng trong tập bộ lọc trước tìm kiếm. Tour hạng 37 vẫn là #37 khi kết quả chỉ còn một dòng.
4. Nhấp thanh hoặc dòng tour mở danh sách tài khoản đã hỏi: tên, kênh, số điện thoại nếu có, trích tin nhắn, thời điểm và số lần hỏi.
5. Một khách một dòng; mở rộng để xem từng lần hỏi. Mỗi lần có nút Mở tin nhắn mở tab mới, tải đúng hội thoại và tin, cuộn tới tin rồi làm nổi bật. Không chỉ mở đầu hội thoại.

## Quy tắc và xác nhận

- Người dùng đã xác nhận: giá bán tour và số khách duy nhất đã hỏi. Không tính doanh thu tiềm năng bằng giá nhân khách quan tâm.
- Người dùng đã xác nhận: Admin Digital chỉ xem trong phạm vi được cấp quyền, không tự động xem tất cả phòng ban.
- Chưa cấp quyền trả lời tin, tạo tài khoản hoặc chốt đơn cho Digital. Giao diện hội thoại xem chi tiết ở chế độ chỉ xem.
- Tour mới: đăng trong 30 ngày, tách bộ lọc với danh sách mọi tour đã được hỏi. Tour mới chưa ai hỏi hiển thị 0 khách, chưa xếp hạng.
- Một khách hỏi cùng tour nhiều lần vẫn chỉ một khách; số lượt hỏi tách riêng. Một khách quan tâm nhiều tour được tính riêng từng tour, không cộng các dòng thành tổng khách duy nhất toàn hệ thống.
- Đồng điểm cùng hạng theo competition ranking (1,2,2,4); tìm tên không thay đổi hạng. Đổi thời gian/kênh/phạm vi được phép thay đổi tập xếp hạng.
- Tour ngừng bán vẫn có lịch sử, ghi rõ trạng thái và giá gần nhất. Trích tin nhắn giữ nguyên giá khách đã nói, khác giá hiện tại nếu có thay đổi.
- Không tự gán hỏi điểm đến chung cho tour cụ thể. Cần liên kết tourId với messageId, conversationId, customerId và thời điểm; trường hợp chưa xác định tour phải để riêng.
- SĐT thiếu hiển thị Chưa có. Tin bị xóa hoặc hết quyền hiển thị không còn khả dụng, không dùng bản trích để vượt quyền.

## Handoff triển khai sau khi duyệt thiết kế

Deep link dự kiến: /inbox?conversationId=<id>&messageId=<id>, target=_blank với rel=noopener. Đây là hợp đồng đề xuất, chưa có tính năng này trong mã ứng dụng hiện tại. Máy chủ phải kiểm tra quyền với cả hội thoại và tin nhắn, xác nhận tin thuộc hội thoại; tải được tin cũ ngoài trang đầu. Thứ hạng phải tính trước bộ lọc tìm kiếm và tính trên toàn tập đã lọc, không riêng trang đang xem. API bảng, tổng số, xuất file và xem tin dùng cùng phạm vi.

Số liệu, tên và số điện thoại trên bản thiết kế chỉ là minh họa.
