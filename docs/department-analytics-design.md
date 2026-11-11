# Thiết kế thống kê theo phòng ban

Ngày: 10/11/2026. Trạng thái: chỉ thiết kế trên Stitch theo xác nhận của người dùng, chưa triển khai phân quyền hoặc thay đổi dữ liệu thực.

## Phạm vi đã được người dùng điều chỉnh

Người dùng xác nhận chỉ cần **doanh thu tour đã chốt**, không phải lợi nhuận: ví dụ tour Trung Quốc 19.990.000đ. Tổng hợp theo đơn, tour, sale và phòng ban. Giá theo người nhân số khách, ưu tiên tổng tiền thực tế của đơn nếu có điều chỉnh. Thay tab Doanh thu & Chi phí bằng **Doanh thu đã chốt**; bỏ lợi nhuận, ngân sách, chứng từ, ghi nhận chi phí, phân bổ chi phí và các biểu đồ chi phí khỏi thiết kế cuối. Các mục chi phí bên dưới là ghi chép đề xuất ban đầu đã được thay thế bởi quyết định này. Đơn chờ và đơn hủy không tính vào doanh thu đã chốt, vẫn hiển thị riêng để đối soát. Không gọi doanh thu là lợi nhuận hoặc thực thu.

Project: https://stitch.withgoogle.com/projects/5451236824423667128

## Phạm vi truy cập

| Vai trò | Thống kê | Hội thoại | Tạo tài khoản |
| --- | --- | --- | --- |
| Admin toàn quyền | Toàn công ty, từng phòng, so sánh phòng | Toàn bộ | Admin phòng và sale |
| Admin phòng | Chỉ phòng mình | Chỉ phòng mình | Chỉ sale thuộc phòng mình |
| Sale | Theo chính sách được duyệt | Khách được phân công | Không |

Tài khoản chủ hiện tại phải giữ quyền toàn hệ thống. Phạm vi phòng được xác định từ phiên đăng nhập ở máy chủ, không tin departmentId do trình duyệt gửi. Phải áp dụng cùng phạm vi cho API, tìm kiếm, xuất báo cáo, websocket, tệp đính kèm và cache. Admin phòng không được gán vai trò admin hay chuyển tài khoản sang phòng khác. Cache thống kê cần khóa theo phạm vi quyền, phòng và bộ lọc.

## Bộ màn hình

1. Tổng quan toàn công ty: KPI, xu hướng, phễu khách, so sánh FIT/Inbound, cảnh báo.
2. Tổng quan phòng: phạm vi cố định, cùng hệ chỉ số, không có dữ liệu phòng khác.
3. Khách & Tour: tour được hỏi/chốt/hủy, lý do hủy, danh sách khách chi tiết.
4. Hiệu suất sale: được giao, phản hồi, chưa phản hồi, khách chốt, đơn, doanh thu, SLA, mục tiêu.
5. Chi tiết sale: xu hướng, kết quả theo tour, danh sách khách và hoạt động.
6. Doanh thu đã chốt: doanh thu theo đơn, tour, sale và phòng; giá/người, số hành khách, tổng tiền đơn; đơn chờ và hủy tách riêng.
7. Phòng ban & Phân quyền: phòng, admin phòng, sale, biểu mẫu tạo tài khoản phù hợp vai trò.

Bộ lọc: khoảng ngày, kỳ so sánh, độ chi tiết ngày/tuần/tháng/quý, phòng (chỉ admin toàn quyền), sale, kênh, tour. Drill-down giữ nguyên bộ lọc và phạm vi. Có trạng thái đang tải, trống, lỗi, chưa tích hợp và dữ liệu cập nhật lúc nào.

## Định nghĩa chỉ số đề xuất

- Khách, đơn đặt tour và hành khách là ba đơn vị riêng.
- Khách hỏi tour: khách duy nhất có sự kiện hỏi tour trong kỳ; cần dữ liệu sự kiện có cấu trúc, không suy đoán đơn thuần từ lần nhắn gần nhất.
- Phễu và tỷ lệ chốt: cùng tập khách phát sinh nhu cầu trong kỳ, theo dõi đến mốc cập nhật. Tử số là khách có ít nhất một đơn xác nhận còn hiệu lực; mẫu số là khách thuộc tập này. Không lấy số đơn chia số khách.
- Khách được phản hồi: khách duy nhất được nhân viên thực sự phản hồi; tách phản hồi bot và số tin nhắn.
- Hiệu suất sale: tỷ lệ chốt trên cùng tập khách được giao; ghi nhận doanh thu theo người chốt tại thời điểm chốt. Lưu lịch sử phân công để việc chuyển sale không viết lại quá khứ.
- Các sale có thể phối hợp trên cùng khách: tổng khách của từng sale không mặc nhiên bằng khách duy nhất của phòng. Tương tự với khách liên phòng và khách hỏi nhiều tour.
- Tỷ lệ hủy theo tập đơn tạo trong kỳ: đơn hủy / (đơn xác nhận + đơn hủy). Ghi rõ đơn đang chờ không nằm trong mẫu số. Mẫu số 0 hiển thị dấu gạch, không hiển thị 0%.
- Giá trị đơn xác nhận không đồng nghĩa tiền thực thu. Thu tiền, hoàn tiền và công nợ cần sổ giao dịch riêng.
- Lợi nhuận tạm tính chỉ có nghĩa khi đủ giá vốn và chi phí; khoản hoàn/giảm trừ chỉ trừ một lần. Thiếu dữ liệu phải thể hiện thiếu dữ liệu, không mặc định 0.
- SLA và thời gian phản hồi trong giờ làm cần lịch trực/giờ làm và ngưỡng được xác định; số hiện tại là phản hồi yêu cầu liên hệ, không tự coi là phản hồi đầu tiên của mọi khách.
- Kỳ báo cáo theo giờ Việt Nam, thời điểm kết thúc khoảng lọc loại trừ để không đếm trùng hai kỳ liền nhau.

## Chi phí đề xuất ban đầu — đã loại khỏi phạm vi

Không thiết kế quản lý chi phí theo xác nhận cuối của người dùng. Không cần nguồn lợi nhuận, sổ thu/chi hoặc ngân sách để triển khai báo cáo doanh thu đã chốt.

## Khoảng cách với mã nguồn hiện tại

Schema hiện có ADMIN và SALE, chưa có Department hoặc admin phòng. StatsService hiện tổng hợp toàn hệ thống và cache chưa chia phòng. Có Deal (tour, số khách đi, số tiền, người chốt, trạng thái), ContactResponse và AiUsage. Chưa có dữ liệu cấu trúc đầy đủ cho nhu cầu hỏi tour, lịch sử phân công, chi phí vận hành, ngân sách và sổ thu/hoàn tiền. Cần bổ sung trước khi đưa các chỉ số mới thành báo cáo thật.

Không đổi hàng loạt ADMIN hiện tại thành admin phòng. Khi triển khai phải xác định tài khoản chủ, ánh xạ dữ liệu cũ vào phòng có chủ đích và kiểm thử chống đọc/ghi chéo phòng, bao gồm xuất file và realtime.

## Điểm đang cần người dùng xác nhận

1. Đã xác nhận: không cần chi phí hoặc lợi nhuận, chỉ doanh thu từ giá trị tour đã chốt.
2. Đã xác nhận: chỉ thiết kế trên Stitch trước, chưa triển khai vào ứng dụng.
3. Đã xác nhận: số tiền theo tour/đơn, ví dụ tour Trung Quốc 19.990.000đ.

Số liệu trong thiết kế là dữ liệu minh họa.

## Màn hình đã lưu trên Stitch

Ưu tiên ba màn hình mới có tiền tố BẢN CHỐT (tên phiên bản thiết kế, không phải phê duyệt của người dùng):

- BẢN CHỐT — Thống kê phòng FIT: `dc7bbd46139f4199a94ea58225b020e8`.
- BẢN CHỐT — Hiệu suất sale toàn công ty: `d3746b2b23ae4b95822882c95cd861e7`.
- BẢN CHỐT — Doanh thu theo tour và phòng ban: `d7961148c025437399b6272d78fa6a1f`.

Bản bổ trợ để xem ý tưởng:

- Tổng quan toàn công ty: `b313b1f68f8b4e6195b844e8818d501f`.
- Khách & Tour: `883b566ccd3042d6abe99e9a2012dc1b`.
- Quản trị tài khoản & Phân quyền phòng ban: `0501e457d59c405aaacadc5afd373181`.

Đã tải và xem ảnh render của cả sáu màn hình. Stitch có hiện tượng edit_screens trả DOM operations nhưng tải lại file vẫn thấy bản cũ; vì vậy ba màn hình chính được tạo mới thực sự để lưu nội dung cập nhật. Các bản bổ trợ vẫn là bản nháp, chưa coi là QA hoàn tất. Một số nhãn do Stitch tự sinh như đã kiểm toán, đã phê duyệt, đã thanh toán hoặc năm 2024/2025 chỉ là nội dung mẫu không có giá trị xác nhận thực tế. Cần bỏ khi hoàn thiện. Drawer sale đang phủ phần phải bảng; cần chốt bố cục khi đóng/mở. Biểu đồ FIT còn cắt nhãn trục trái. Số liệu mẫu độc lập giữa các màn, không phải báo cáo thật hoặc một bộ dữ liệu tích hợp đã đối soát.
