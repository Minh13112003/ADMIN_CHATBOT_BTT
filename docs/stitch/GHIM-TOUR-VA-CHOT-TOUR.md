# Thiết kế: Gắn tour quan tâm (ghim tin nhắn), Chốt tour 2 tab có voucher, Voucher theo chi nhánh, Nhu cầu tour theo địa điểm

Tài liệu gửi Gemini để vẽ trên Stitch. Project Stitch: **BenThanh Tourist Omnichannel Workspace** (id `5451236824423667128`). Vẽ thêm màn mới vào project này, giữ đúng giao diện các màn đã có.

## Quy tắc giao diện chung (bắt buộc)

- Dùng **thanh bên sáng 248 px** mô tả trong `docs/stitch/THANH-BEN-MOI.md`. Không dùng thanh bên đỏ cũ.
- Font **Be Vietnam Pro**. Chữ thân 13 px, chữ phụ 12 px, tiêu đề trang 20 px đậm.
- Màu: đỏ thương hiệu `#D0021B`, đỏ đậm `#B30118`, nền trang `#F7F6F3`, thẻ trắng viền `#E6E2DA` bo 12-14 px, bóng nhẹ. Xanh lá cho thành công, vàng cho chờ, xanh dương cho thông tin.
- Mọi chữ **tiếng Việt có dấu**, không emoji. Nút chính cao tối thiểu 44 px. Nút chỉ có icon có nhãn khi rê chuột.
- Vẽ mỗi màn ở **1440 px** và **390 px** (điện thoại). Ở 390 px, cột thông tin khách thành ngăn kéo trượt từ phải, hộp thoại thành toàn màn hình.
- Số liệu, tên khách, số điện thoại chỉ là minh hoạ. Không ghi "Dữ liệu minh họa", "Đã kiểm toán", năm 2024/2025 lên màn hình.
- Tên tour, mã, giá lấy theo dạng thật của API (xem `docs/tour-api.md`), ví dụ: tour "Du Lịch Trung Quốc: Ô Trấn - Hàng Châu - Thượng Hải", mã đợt `A06.FIT.CN.200127.A`, giá 19.990.000 đ/người.

## Khái niệm (để vẽ đúng)

- **Địa điểm** = thể loại tour của website (Trung Quốc, Thái Lan, Nhật Bản...).
- **Tour** = một chương trình tour, có tên và nhiều **ngày khởi hành**. Mỗi ngày khởi hành có **mã đợt** và giá riêng.
- **Nhãn tour quan tâm** gắn theo **tour**, không theo ngày khởi hành. Một tour không bị tách thành 4-5 nhãn cho 4-5 ngày khởi hành.
- **Chốt tour** mới cần chọn ngày khởi hành, số khách, voucher.

---

## Màn 1. Cột thông tin khách (nút 3 gạch) có tab "Tour quan tâm"

Vị trí: trang Hội thoại, cột bên phải mở bằng nút 3 gạch ở đầu khung chat. Cột hiện có 3 tab: Khách, Đơn tour, Hẹn & ghi chú. **Thêm tab "Tour quan tâm"** (đặt thứ 2).

Nội dung tab:

1. Nút **"+ Gắn tour quan tâm"** đỏ, toàn chiều rộng.
2. Danh sách nhãn, mới nhất ở trên. Mỗi nhãn là một thẻ:
   - Dòng 1: **tên tour** (đậm, tối đa 2 dòng) + chip địa điểm (ví dụ "Trung Quốc").
   - Dòng 2: chữ nhỏ "Gắn bởi Minh · 10:24 12/11/2026".
   - Khối **tin nhắn đã ghim**: nền xám nhạt, viền trái 3 px màu đỏ, trích tối đa 3 dòng, có tên người gửi (Khách / Minh) và giờ gửi.
   - Hai nút nhỏ: **"Xem trong đoạn chat"** (cuộn khung chat tới tin đó và làm nổi bật vàng nhạt 2 giây), **"Gỡ nhãn"** (hỏi lại trước khi gỡ).
3. **Cùng một tour gắn lần thứ 2** (khách quay lại hỏi sau một thời gian): hiện thành thẻ riêng, có huy hiệu "Lần 2" và ngày. Vẽ ví dụ: tour Ô Trấn - Hàng Châu có 2 thẻ, "Lần 1 · 02/10/2026" và "Lần 2 · 10/11/2026".
4. Trạng thái rỗng: hình minh hoạ nhỏ + "Chưa gắn tour nào. Gắn tour khách quan tâm để Digital theo dõi."

Trong khung chat (cột giữa): tin đã được ghim có **icon ghim nhỏ** và chip tên tour ngay dưới bong bóng tin.

## Màn 2. Hộp "Gắn tour quan tâm" (2 bước)

Hộp thoại giữa màn hình, rộng khoảng 640 px. Có thanh bước "1. Chọn tour · 2. Ghim tin nhắn".

**Bước 1: Chọn tour**
- Dãy chip địa điểm cuộn ngang: Tất cả, Trung Quốc, Thái Lan, Nhật Bản, Hàn Quốc, Châu Âu, Trong nước...
- Ô tìm: "Tìm theo tên tour hoặc mã đợt". Gõ mã đợt `A06.FIT.CN.200127.A` cũng ra đúng tour.
- Danh sách tour: ảnh nhỏ 56 px, tên tour, "6N5Đ · từ 19.990.000 đ · 5 ngày khởi hành", chip địa điểm. Tour **đã gắn** trong hội thoại này có chip "Đã gắn 1 lần".
- Nút **"Tiếp tục"**.

**Bước 2: Ghim tin nhắn làm bằng chứng**
- Ô tìm **trong đoạn chat này** kiểu Messenger: gõ chữ, hiện "3 kết quả", hai nút mũi tên lên/xuống để nhảy giữa các kết quả, chữ khớp được tô vàng.
- Bên dưới: danh sách tin nhắn của hội thoại (cuộn được), mỗi tin có ô chọn tròn bên trái. Tin của sale có chứa mẫu tour được **gợi ý sẵn** với chip "Gợi ý: có tên tour".
- Chọn đúng **một** tin. Tin được chọn có viền đỏ.
- Nút **"Gắn nhãn"** (đỏ) và "Quay lại".

Ghi chú cho người vẽ: một hội thoại gắn được nhiều tour; mỗi lần gắn ghim đúng một tin.

## Màn 3. Hộp "Chốt tour" thay hộp cũ

Thay hoàn toàn hộp hiện tại (Tên tour, Mã tour, Số khách, Tổng tiền, Mã đơn). Hộp rộng khoảng 560 px, có **2 tab** ở đầu:

**Tab "Theo mã tour"**
1. Ô **Mã tour** (nhập mã đợt hoặc tìm tên). Nhập xong tự hiện thẻ tour: ảnh, **tên tour**, địa điểm.
2. Ô chọn **Ngày khởi hành**: danh sách các ngày, mỗi dòng "20/01/2027 · A06.FIT.CN.200127.A · 19.990.000 đ/người · còn 8 chỗ". Ngày hết chỗ bị mờ.
3. Ô **Số khách** (chỉ ô này sale phải nhập tay).
4. Ô **Mã voucher** (không bắt buộc) + nút "Áp dụng". Mã hợp lệ: chip xanh "Giảm 1.000.000 đ" và nút x để bỏ. Mã sai hoặc hết hạn: chữ đỏ ngay dưới ô.
5. Khối tổng tiền nền xám: "Giá 19.990.000 đ × 2 khách = 39.980.000 đ", "Voucher −1.000.000 đ", dòng **"Số tiền cuối cùng: 38.980.000 đ"** to, đậm.
6. Nút **"Chốt tour"** đỏ, "Huỷ".

**Tab "Theo mã đơn"** (khách đã đặt qua chatbot, có mã đơn)
1. Ô **Mã đơn** + nút "Tải đơn".
2. Tải xong hiện thẻ đơn **chỉ đọc**: tên tour, ngày khởi hành, mã đợt, số khách, giá, tổng tiền, trạng thái "Chờ xác nhận".
3. Ô **Mã voucher** như tab kia (sale nhắn hỏi khách có voucher không rồi nhập). Có nút "Sửa số khách" nếu khách đổi.
4. Khối tổng tiền và **Số tiền cuối cùng**.
5. Nút **"Xác nhận đơn"**.

Vẽ thêm 2 trạng thái: mã đơn không tồn tại, và voucher không áp dụng cho tour này ("Voucher này không áp dụng cho tour đã chọn").

## Màn 4. Quản lý voucher (chỉ admin chi nhánh)

Mục mới ở thanh bên, nhóm quản trị: **"Voucher"**. Sale không thấy mục này.

- Đầu trang: tiêu đề "Voucher", nút đỏ **"+ Tạo voucher"**.
- 3 thẻ số: Đang hiệu lực, Đã dùng trong tháng, Sắp hết hạn (7 ngày).
- Bảng: Mã voucher (chữ đậm, có nút sao chép), Giảm (ví dụ "1.000.000 đ" hoặc "5%"), Áp dụng cho (tên tour hoặc "Mọi tour Trung Quốc"), Hiệu lực (từ ngày - đến ngày), Đã dùng / Giới hạn (ví dụ 12/50), Trạng thái (Hiệu lực xanh / Hết hạn xám / Tạm khoá vàng), nút sửa.
- Cột Giảm ghi đủ mức trần khi giảm theo phần trăm, ví dụ "20% (tối đa 3.000.000 đ)".
- Ngăn kéo **Tạo voucher** bên phải: Mã voucher, Kiểu giảm (2 nút chọn: **Theo số tiền** / **Theo phần trăm**), Giá trị. Chọn phần trăm thì hiện thêm ô **Giảm tối đa (đ)**. Áp dụng cho (3 lựa chọn: **Một tour** / **Một địa điểm** / **Mọi tour**, chọn tour hoặc địa điểm thì hiện ô tìm), Ngày bắt đầu, Ngày kết thúc, Số lần dùng tối đa, Ghi chú.

## Màn 5. Nhu cầu tour (Digital) có 2 tab: Theo địa điểm, Theo tour chi tiết

Giữ bố cục trang "DIGITAL FINAL — Top 10 tour quan tâm" đã có (4 thẻ số, bảng, nút Phóng to). Thêm **2 tab** ngay dưới tiêu đề:

**Tab "Theo địa điểm"**
- Bảng: Hạng, Địa điểm, Số khách quan tâm, Số lượt gắn, Số tour có khách quan tâm, thanh mức độ quan tâm.
- Bấm một địa điểm thì **xổ ra ngay dưới dòng** các tour của địa điểm đó (thụt lề), mỗi tour có số khách và số lượt. Không có dòng "Chưa xác định tour".

**Tab "Theo tour chi tiết"**
- Bảng như màn Top 10 hiện tại: Hạng, Tên tour (+ chip địa điểm), Giá / người, Khách quan tâm, Lượt gắn, Mức độ quan tâm.

**Ngăn kéo khi bấm một tour** (cả 2 tab đều mở được):
- Mỗi khách một thẻ: tên, kênh (bttAI Web, bttAI App, Zalo OA, Facebook), số điện thoại.
- Mỗi lần quan tâm là một dòng: nguồn ("Thẻ tour chatbot" hoặc "Sale gắn: Minh"), **tin nhắn đã ghim** (trích), **thời gian**, nút **"Mở tin nhắn"** mở tab mới tới đúng tin.
- Khách được gắn 2 lần thì hiện 2 dòng có huy hiệu "Lần 1", "Lần 2".

## Màn 6 (để sau, vẽ nếu còn thời gian). Mẫu tour trong ô trả lời nhanh

Trong bảng chọn mẫu trả lời nhanh ở khung chat, thêm tab **"Tour"** cạnh tab mẫu chữ. Mỗi dòng: mã đợt gần nhất, tên tour, giá từ. Bấm chèn vào ô soạn tin đoạn mẫu "Tên tour – Lịch trình X ngày – Giá từ ... – Link". Không tách theo ngày khởi hành.

---

## Quy tắc chủ dự án đã chốt (11/11/2026)

1. **Voucher có 2 loại:** giảm theo **số tiền** (ví dụ 1.000.000 đ), hoặc giảm theo **phần trăm có mức trần** (ví dụ 20%, tối đa 3.000.000 đ).
2. **Phạm vi voucher có cả 3 kiểu:** một tour, một địa điểm, mọi tour.
3. **Admin chi nhánh = Admin phòng ban** (vai trò đã có). Chỉ vai trò này và admin toàn quyền tạo, sửa voucher. Sale chỉ nhập mã khi chốt.
4. **Sale không được sửa giá.** Luồng chốt: nhập mã tour, chọn ngày khởi hành (giá lấy theo ngày đó), nhập số khách, hệ thống tự tính tiền, áp voucher nếu có, ra **số tiền cuối cùng**. Không vẽ ô sửa giá hay sửa tổng tiền.

Còn một giả định chưa hỏi: voucher giảm trên **tổng đơn**, không nhân theo số khách. Ví dụ ở Màn 3 vẽ theo giả định này.
