# Đánh giá chatbot bttAI bằng 160 câu hỏi (2026-11-23)

Chạy Gemini thật, mỗi câu một cuộc trò chuyện mới, không ghi vào trang quản trị. Bộ 1: 100 câu của chủ dự án (`D:\ChatBot\b_100_c_u_h_i_...md`). Bộ 2: 60 câu kiểu khách chat Zalo/Facebook (viết tắt, không dấu, khiếu nại, ngoài lề) do một agent soạn; agent chỉ tra mạng 2 lần, phần lớn câu là tổng hợp từ hiểu biết sẵn có, nên coi là bộ bổ sung, không phải dữ liệu thật.

## Kết quả

- 160/160 câu chạy không lỗi, trung bình 3,9 giây (bộ 1) và 5,6 giây (bộ 2) mỗi câu.
- **Tốt:** thông tin công ty (chi nhánh, hotline, email), giá trẻ em 40/80/100%, tìm tour theo điểm đến và ngân sách, so sánh tour, hỏi lại khi câu mơ hồ, chống bịa ("tour lên mặt trăng"), chống ép giảm giá 90%, từ chối làm việc trái phép (trốn ở lại), từ chối viết code, nhận ra trang giả mạo, chuyển nhân viên khi khiếu nại/mất hành lý/đòi gặp người/để lại số điện thoại.
- **Chưa tốt nhất: 76/160 câu trả lời "chưa có thông tin, xem mục Điều khoản / gọi hotline / nhắn gặp nhân viên"**, 40 câu trong số đó vẫn kèm thẻ tour không liên quan. Không bịa, nhưng khách không nhận được câu trả lời. Đây là thiếu dữ liệu chính sách, không phải lỗi mô hình.

## Cập nhật chiều 2026-11-23: chính sách lấy từ API từng tour

Chủ dự án chỉ ra chính sách nằm trong API chi tiết tour (`punishment_cancel_booking`, `cancel_booking`, `tuts_booking_payment`, `tour_price_included`, `tour_price_not_included`, `warning_note`, `warning_note_visa`). Kiểm tra 68 tour đang bán: **tour trong nước dùng chung một chính sách** (cọc 50%, còn lại trước 7 ngày, huỷ theo bậc 50/60/80/100%); **tour nước ngoài cọc 50% giống nhau nhưng phí huỷ có 23 phiên bản, hạn thanh toán, tip, phụ thu phòng đơn khác nhau theo tour** (ví dụ Trung Quốc huỷ 5-7 ngày mất 100%), nên lấy theo đúng tour khách hỏi, không gộp được. Đã làm module `chinh_sach_tour.py`: câu hỏi chính sách thì lấy chính sách của tối đa 2 tour đang bàn (lưu tạm 6 giờ), chưa nói tour nào thì đưa mẫu trong nước + một tour nước ngoài làm ví dụ và bảo AI hỏi lại khách; sửa câu lệnh nền (trước đây cấm nói mức huỷ, cọc). Hỏi lại 41 câu chính sách: còn 14 câu "chưa có thông tin" (trước đó gần như tất cả), các câu còn lại trả đúng số liệu (cọc 50%, phí huỷ theo bậc, tip Nhật 41 USD, phụ thu phòng đơn Hàn Quốc 8.000.000 đ, bảo hiểm trong nước 100 triệu, hành lý, khách từ 70 tuổi cần giấy sức khoẻ, không nhận từ 80 tuổi). Còn "chưa có thông tin" thật: ăn chay/dị ứng, số người trong đoàn, trả góp/quẹt thẻ, SIM/wifi, chuyển nhượng suất, bà bầu, đổi ngày do ốm.

## Cập nhật 2026-11-25: mục chưa có dữ liệu thì báo nhân viên

Theo chủ dự án: ăn chay / dị ứng, số người trong đoàn, trả góp / quẹt thẻ, SIM / wifi, chuyển suất, bà bầu, đổi ngày vì ốm, khẩn cấp ban đêm, giảm giá nhóm / Early Bird / thẻ thành viên / mã giảm giá / gift voucher không còn trả "chưa có thông tin" mà báo nhân viên (Liên hệ) và nói "mình sẽ liên hệ nhân viên tư vấn, trong lúc chờ bạn cứ hỏi mình vấn đề khác". Nhờ vậy hai lỗi "Xin mã giảm giá, khách cũ" và "Mua Gift Voucher" bên dưới cũng không còn.

## Thiếu dữ liệu chính sách (trước cập nhật trên)

Cọc bao nhiêu % và hạn thanh toán; phí huỷ theo mốc ngày (thường, Lễ Tết); hoàn tiền bao lâu; rớt visa; bất khả kháng (bão, ốm); phụ thu phòng đơn; tiền tip HDV; giá đã gồm vé máy bay/bảo hiểm/thuế chưa; hạn mức bảo hiểm; trả góp, quẹt thẻ; hoá đơn VAT; hạn hộ chiếu; visa từng nước (Thái, Singapore, Hàn, Nhật...); giảm giá nhóm, Early Bird, thẻ thành viên; hành lý; ăn chay/dị ứng; người cao tuổi, bà bầu, xe lăn; SIM/wifi; số khẩn cấp ban đêm khi đang ở nước ngoài.

## Lỗi trong mã đã sửa (có test, `tests/test_danh_gia_160_cau.py`)

1. "thứ 6 – **chủ nhật**" bị hiểu là Nhật Bản ("chưa có tour Nhật 3 ngày").
2. "lớp mình **30 ng**" (viết tắt "người") không nhận là đoàn đông nên không báo nhân viên.
3. Mở nhầm luồng đặt tour: "muốn **hỏi thêm** tour Nha Trang, hỏi được ko", "đặt giùm khách sạn, **ko đi tour**", "đăng ký tour... đặt vé máy bay nối chuyến?", "đăng ký tour thì cần lưu ý gì về visa?", "đặt tiếp có ưu đãi khách thân thiết không?". Nay trả lời bằng Gemini, khách bấm "Tôi muốn đặt tour này" khi muốn đặt thật.
4. "đặt khách sạn ... ko đi tour" nay báo nhân viên (vé/khách sạn lẻ).

## Còn lỗi, chưa sửa

- "Đà Lạt 2N1Đ từ SG" trả tour Đắk Nông - Hồ Tà Đùng là "phù hợp nhất".
- "Mua Gift Voucher" trả "chưa có tour đi Gift Voucher" (coi là địa danh).
- "Tôi chuyển cọc 2 ngày rồi mà chưa ai gọi lại" chỉ xin mã đơn, không báo nhân viên.
- "Xin mã giảm giá, mình là khách cũ": Gemini lỗi, trả câu dự phòng "Mình tìm được vài tour phù hợp" nhưng không có thẻ.
- Hỏi chiến lược/vé lẻ "tự ý tách đoàn 1 ngày" bị trả câu viết sẵn về "vé máy bay lẻ".
- "Hoá đơn VAT cho công ty" bị trả câu viết sẵn "đoàn công ty hoặc đoàn đông người".
- Câu hỏi chính sách không nhắc điểm đến vẫn kèm 5 đến 13 thẻ tour (ví dụ visa Đông Nam Á, đoàn không đủ khách).
- Khẳng định chưa kiểm chứng: "BenThanh luôn có bộ phận hỗ trợ visa" (tour Nhật), "người làm nghề tự do hoàn toàn có thể xin visa".
