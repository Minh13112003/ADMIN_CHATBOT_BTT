# Prompt Stitch: Nhu cầu tour (Digital) bỏ ngăn kéo phải, thêm hộp "Thống kê tour"

Project Stitch: **BenThanh Tourist Omnichannel Workspace** (id `5451236824423667128`). Sửa từ màn **"Nhu cầu tour (Digital) - BenThanh Tourist"**. Giữ thanh bên sáng, font Be Vietnam Pro, đỏ `#D0021B`, nền `#F7F6F3`, chữ tiếng Việt có dấu, không emoji.

---

Vẽ 2 màn ở 1440 px (và bản 390 px cho màn 2):

## Màn 1. Trang Nhu cầu tour không còn ngăn kéo bên phải

- **Bỏ hẳn** cột "Khách quan tâm tour" bên phải. Bảng chiếm toàn bộ chiều rộng nội dung.
- Giữ 2 tab "Theo địa điểm" / "Theo tour chi tiết", ô chọn kỳ, 4 thẻ số.
- Cột **Tên tour** rộng hơn: tên tour nằm trên **một dòng** (tối đa 2 dòng nếu rất dài), chip số ngày (6N5Đ) và chip địa điểm nằm cạnh, không bị bẻ từng chữ.
- Cuối mỗi dòng tour có nút chữ **"Xem thống kê"** (viền xám, icon biểu đồ). Bấm cả dòng cũng mở hộp.
- Tab "Theo địa điểm": dòng địa điểm vẫn xổ ra các tour con; mỗi tour con cũng có nút "Xem thống kê".

## Màn 2. Hộp "Thống kê tour" (mở khi bấm một tour)

Hộp thoại **giữa màn hình**, rộng khoảng 720 px, cao tối đa 88% màn hình, nội dung cuộn bên trong. **Nền phía sau phủ đen 40% và làm mờ (blur)**. Phong cách giống hộp "Chốt tour & Đặt cọc" đã có: chấm đỏ trước tiêu đề, nút X góc phải, tab gạch chân đỏ, chân hộp có nút.

**Đầu hộp**
- Chấm đỏ + tiêu đề nhỏ "Thống kê tour".
- Thẻ tour: ảnh 64 px, **tên tour** đậm ("Du Lịch Trung Quốc: Ô Trấn - Hàng Châu - Thượng Hải"), chip địa điểm "Trung Quốc", chip "6N5Đ", "Giá từ 19.990.000 đ/người".
- Bên phải: hạng "Hạng 1 / 128 tour".

**2 tab:** "Tổng quan" và "Khách quan tâm (45)".

**Tab Tổng quan**
1. 4 ô số nhỏ: Khách quan tâm (45), Lượt gắn (58), Đã chốt (12 đơn), Tỷ lệ chốt (26,7%).
2. Biểu đồ cột nhỏ "Lượt quan tâm theo ngày" trong kỳ đang chọn (cột đỏ nhạt, cột hôm nay đỏ đậm).
3. Hai khối cạnh nhau:
   - **Theo kênh**: thanh ngang bttAI Web, bttAI App, Zalo OA, Facebook, mỗi dòng có số và phần trăm.
   - **Theo nguồn**: "Thẻ tour chatbot" và "Sale gắn", rồi top 3 sale gắn nhiều nhất (tên, số lượt).
4. Dòng nhỏ: "Lần quan tâm đầu: 02/10/2026 · Gần nhất: 10/11/2026".

**Tab Khách quan tâm**
- Ô tìm "Tìm tên hoặc số điện thoại", lọc kênh.
- Mỗi khách một thẻ: chữ viết tắt tên, tên, kênh (màu theo kênh), số điện thoại, huy hiệu "2 lần hỏi".
- Mỗi lần quan tâm một dòng: huy hiệu "Lần 2 · 10/11/2026" (cam cho lần mới nhất, xám cho lần cũ), nguồn ("Sale gắn: Minh" hoặc "Thẻ tour chatbot"), trích tin nhắn đã ghim trong khối viền trái, nút chữ đỏ **"Mở tin nhắn"** có icon mở tab mới.
- Cuộn trong hộp, phân trang "Xem thêm".

**Chân hộp**
- Trái: "Đang hiển thị 3 / 45 khách" (chỉ ở tab Khách quan tâm).
- Phải: nút viền "Đóng", nút đỏ **"Xuất danh sách"**.

**Bản 390 px:** hộp thành toàn màn hình, 4 ô số xếp 2 × 2, hai khối Theo kênh / Theo nguồn xếp dọc.

Số liệu chỉ là minh hoạ, không ghi "Dữ liệu minh họa" lên màn hình.
