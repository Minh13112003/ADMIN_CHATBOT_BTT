# 6 màn hình chưa có HTML: bản vẽ bằng chữ cho Codex

Bổ sung cho `docs/giao-dien-tu-stitch.md` (mục 4). Công cụ Stitch không ghi được mã HTML ra đĩa, nên 6 màn hình này được mô tả đầy đủ ở đây: bố cục, thành phần, kích thước, trạng thái, dữ liệu. Làm theo file này kết hợp token và quy tắc của dự án (font Be Vietnam Pro, màu trong `globals.css`, không emoji, chữ tiếng Việt có dấu). Nếu chủ dự án đưa thêm ảnh chụp, ảnh là chuẩn cuối.

Màu dùng chung: đỏ `#D0021B`, đỏ đậm `#B30118`, nền cát `#FAF9F6`, trắng `#FFFFFF`, viền `#E6E2DA`, nền mục chọn `#FDECEC`. Bo góc thẻ 12 px, nút 10 px. Nút chính cao 44 px.

---

## 1. Hội thoại, máy tính (`/inbox`, từ 1280 px)

```
+--------+----------------+--------------------------------+-----------------+
| Thanh  | Danh sách      | Khung chat                     | Hồ sơ khách     |
| bên    | 340 px         | linh hoạt, tối thiểu 480 px    | 360 px          |
| 248 px |                |                                | (3 tab)         |
+--------+----------------+--------------------------------+-----------------+
```

**Danh sách (340 px):**
- Ô tìm "Tìm tên hoặc số điện thoại" (cao 44 px).
- Hàng chip lọc cuộn ngang: Tất cả, Liên hệ, Chưa xem, Chờ xử lý, Đã chốt (mỗi chip có số). Lọc kênh (bttAI, Zalo khoá, Facebook khoá) gom vào một nút "Kênh".
- Mỗi hàng cao tối thiểu 72 px: avatar chữ cái đầu, tên đậm, giờ bên phải, dòng xem trước 1 dòng cắt "...", chip trạng thái nhỏ, chấm đỏ số tin chưa đọc. Hàng đang chọn: nền `#FDECEC`, thanh đỏ 3 px bên trái. Hàng `CONTACT` luôn ghim trên cùng, chữ trạng thái đỏ.
- Trạng thái: đang tải (khung xám nhấp nháy 6 hàng), rỗng ("Chưa có hội thoại"), lỗi (kèm nút "Thử lại").

**Khung chat:**
1. **Tiêu đề đúng một hàng** (cao 64 px): avatar, tên đậm, SĐT nhỏ bên dưới, chip kênh, chip trạng thái. Bên phải: nút chính đỏ **"Chốt tour"**, nút `⋯` mở menu (Chuyển cho đồng nghiệp kèm ghi chú, Trả lại cho bot, Xem hồ sơ khách). Không có nút "Bàn giao ca" riêng.
2. **Dải "Cần làm"** (một dòng, nền vàng nhạt, chỉ hiện khi có): "Khách đòi gặp nhân viên" và/hoặc "Có đơn chờ xác nhận", hai nút nhỏ "Gọi khách", "Xác nhận đơn".
3. **Vùng tin nhắn** cuộn: tin khách bên trái nền trắng viền mảnh; tin nhân viên bên phải nền đỏ nhạt hoặc đỏ đậm chữ trắng; tin bot nền xám nhạt có nhãn "bttAI"; ghi chú nội bộ nền vàng nhạt có nhãn "Nội bộ". Bong bóng tối đa 70% bề rộng. Phân cách ngày. Ảnh hiện thu nhỏ bấm để mở; PDF hiện thẻ có tên, dung lượng, nút tải.
4. **Dòng "Minh đang soạn tin..."** nhỏ phía trên ô soạn khi có đồng nghiệp gõ.
5. **Ô soạn tin** (từ trái sang phải): nút đính kèm (44 px), ô nhập nhiều dòng (tự giãn tối đa 5 dòng), **nút Câu trả lời nhanh (tia sét, 44 px, viền mảnh)**, nút **Gửi** đỏ (44 px). Ảnh/PDF chọn xong hiện xem trước phía trên ô nhập kèm nút bỏ.

**Hồ sơ khách (360 px), 3 tab:** Khách (tên, SĐT, "Chưa xác minh", các cách viết tên, kênh, ghi chú), Đơn tour (danh sách đơn, "Xác nhận", "Khách huỷ", "Chốt tour"), Hẹn & ghi chú (hẹn nhắc, ghi chú nội bộ). Dưới 1280 px cột này thành ngăn trượt từ phải, mở bằng icon 3 gạch.

---

## 2. Hội thoại, điện thoại (390 px)

Mỗi lần **một khung**, không có thanh bên; có **thanh tab dưới** (Hội thoại, Khách hàng, Đơn tour, Hẹn, Thêm), cao 56 px, chỗ chạm 44 px, ẩn khi đang ở khung chat.

- **Khung 1, danh sách:** thanh trên (tên trang, chấm "Đang kết nối", chuông, avatar), ô tìm, chip lọc cuộn ngang, hàng hội thoại cao 72 px như bản máy tính.
- **Khung 2, chat:** thanh trên gọn: nút quay lại, avatar, tên (1 dòng cắt "..."), SĐT nhỏ, nút `⋯`. Nút "Chốt tour" nằm trong menu `⋯` hoặc ngăn kéo hồ sơ (không chiếm chỗ thanh trên). Dải "Cần làm" một dòng, có hai nút ngắn. Bong bóng tối đa 80%. **Ô soạn tin** dính đáy, theo thứ tự: đính kèm, ô nhập, tia sét, Gửi; **không còn hàng chip mẫu**. Chừa vùng an toàn (safe area) dưới cùng.
- **Khung 3, hồ sơ khách:** ngăn kéo từ dưới (bottom sheet) cao 85% màn hình, thanh nắm kéo ở trên, 3 tab như bản máy tính, vuốt xuống hoặc bấm nền tối để đóng.
- Không tràn ngang ở 390 px. Chạm tối thiểu 44 px.

**Bảng Câu trả lời nhanh trên điện thoại:** xem mục 3 của `docs/giao-dien-tu-stitch.md`. Toàn màn hình: thanh trên có nút X, tiêu đề "Câu trả lời nhanh", ô tìm; danh sách mỗi dòng cao tối thiểu 56 px, tiêu đề đậm trên, nội dung xem trước tối đa 2 dòng kết thúc "..." bên dưới, nút con mắt bên phải mở hộp xem toàn bộ nội dung (nút "Đóng", "Dùng mẫu này"). Bấm dòng thì chèn vào ô nhập và đóng.

---

## 3. Mẫu nhanh, đổi tên "Thư viện trả lời" (`/templates`)

Hai tab trên cùng: **Mẫu trả lời nhanh** | **Quy tắc trả lời tự động**.

**Tab Mẫu trả lời nhanh (máy tính):**
```
+------------------------+---------------------------------------------+
| Ô tìm + "+ Thêm mẫu"   | Tiêu đề [..........................]       |
| Danh sách mẫu 360 px   | Nội dung [ nhiều dòng ............... ]    |
|  - Tiêu đề đậm         | 245 / 2000 ký tự                            |
|  - nội dung 1 dòng "..."|                                            |
|                        | [Lưu] [Xoá]  (Xoá: bấm hai lần để xác nhận) |
|                        | Xem trước: bong bóng như khách thấy         |
+------------------------+---------------------------------------------+
```
Điện thoại: chỉ danh sách; bấm một mẫu thì mở trình sửa toàn màn hình, có nút quay lại. Có trạng thái đang tải, rỗng ("Chưa có mẫu nào, bấm Thêm mẫu"), lỗi. Dữ liệu `GET/POST/PATCH/DELETE /templates` đã có.

**Tab Quy tắc trả lời tự động:** bảng (Tên quy tắc, Loại: tin đầu tiên / từ khoá / ngoài giờ, Nội dung trả lời cắt "...", Công tắc bật/tắt, nút Sửa, Xoá). Nút "+ Thêm quy tắc" mở ngăn bên phải (điện thoại: toàn màn hình) với trường theo loại (từ khoá, giờ làm việc). Dùng API quy tắc đã có trong `templates/`.

Chưa làm: phím tắt `/bg-eu`, nhãn `#tag`, "Dùng N lần" (cần cột mới).

---

## 4. Cài đặt hiển thị (`/settings`)

Một trang, các thẻ xếp dọc, rộng tối đa 720 px, căn giữa vùng nội dung.

- **Thẻ "Chế độ hiển thị":** 3 lựa chọn dạng thẻ có xem trước nhỏ: Sáng, Tối, Theo hệ thống. Chọn là đổi ngay, lưu `localStorage`, tránh nháy trắng khi tải (đặt thuộc tính theme trước khi React chạy).
- **Thẻ "Màu nhấn":** 4 chấm màu chọn một: Đỏ BTT (mặc định), Xanh dương, Xanh lá, Tím. Chỉ đổi màu nhấn, trạng thái (xanh/vàng/đỏ) giữ nguyên.
- **Thẻ "Cỡ chữ" (nên có):** Vừa, Lớn (tăng 1 bậc).
- **Thẻ "Tài khoản":** tên, email, vai trò (chỉ đọc), nút "Đổi mật khẩu", "Đăng xuất". Giữ chức năng đang có trong `SettingsPage.tsx` (công tắc "Đang trực" cho sale, ẩn với admin).
- Mục "Thông báo", "Phím tắt", "Phiên đăng nhập" có trong bản vẽ: hiện dạng thẻ mờ ghi "Sắp có", không làm.
- Chi tiết bảng màu tối và cách làm token: `docs/giao-dien-cai-dat-va-bieu-do.md` Phần A.
- Điện thoại: thẻ xếp dọc, lề 16 px, nút 44 px.

---

## 5. Lịch hẹn nhắc (`/reminders`, mới)

Dữ liệu: `conversations.followUpAt`, `followUpNote`; `GET /conversations?followUp=...` đã có. Hẹn nhắc do `ConversationsService.nhacHen` chạy mỗi phút và phát `followup:due`.

**Máy tính:** cột trái (khoảng 2/3) là danh sách nhóm; cột phải 320 px là dải tuần.
- **Nhóm theo thứ tự:** Quá hạn (tiêu đề đỏ, kèm số), Hôm nay, Ngày mai, Tuần này. Nhóm rỗng thì ẩn; không còn gì thì trạng thái rỗng "Không có hẹn nhắc nào".
- **Mỗi mục** (thẻ cao khoảng 88 px): avatar, tên khách, kênh, giờ hẹn, ghi chú (2 dòng cắt "..."), người phụ trách. Nút: **Mở hội thoại**, **Xong**, và menu **Dời**: +30 phút, +2 giờ, Sáng mai 09:00 (múi giờ Việt Nam, UTC+7).
- **Dải tuần (phải):** 7 ô thứ Hai đến Chủ nhật, mỗi ô có số hẹn; bấm một ngày thì lọc danh sách. Hôm nay có viền đỏ.
- Bỏ: "Đồng bộ Lịch Google", "tỷ lệ chăm sóc đúng giờ 98%" (không có dữ liệu).

**Điện thoại:** chỉ danh sách nhóm (dải tuần thành hàng cuộn ngang ở đầu), nút "Mở hội thoại" và "Xong" cao 44 px, "Dời" mở bottom sheet.

Cần kiểm tra: backend có endpoint "xong" và "dời" cho hẹn chưa (đang dùng route đặt hẹn ở `conversations.controller.ts`); thiếu thì thêm kèm test, không sửa tay migration.

---

## 6. Kênh kết nối (`/channels`, mới, chỉ admin)

Lưới 2 cột (điện thoại 1 cột), 4 thẻ cao đều nhau:

| Thẻ | Trạng thái | Nội dung |
|---|---|---|
| bttAI Web | Đã kết nối (chấm xanh) | Số tin hôm nay, thời gian phản hồi trung vị, nút "Mở trang chat thử" |
| bttAI App và Mini App | Đã kết nối | Số tin hôm nay, thời gian phản hồi trung vị |
| Zalo OA | Chưa kết nối (xám, nút khoá) | Điều kiện: OA đã xác thực, gói Tăng trưởng trở lên; ghi chú tin tư vấn miễn phí trong 48 giờ |
| Facebook Messenger | Chưa kết nối (xám, nút khoá) | Điều kiện: quyền Page; trả lời trong 24 giờ |

- Số liệu lấy từ dữ liệu thật theo kênh (`conversations.channel`, mở rộng `stats.service.ts`); chưa có thì hiện "Chưa có số liệu", không bịa số.
- Thẻ trên cùng một dải trạng thái: "Backend: Hoạt động", "Chatbot: Hoạt động" từ `/health`; lỗi thì chấm đỏ kèm "Thử lại".
- **Không hiển thị, không cho sao chép `INGEST_API_KEY`.** Bỏ khối "Khoá Ingest" và nút "Tạo lại khoá" trong bản vẽ; chỉ ghi "Đã cấu hình" hoặc "Chưa cấu hình" nếu cần.
- Thẻ Zalo và Facebook chỉ thông tin, chưa có luồng kết nối (xem `.claude/rules/integrations.md`).

---

## Gợi ý thứ tự làm cho 6 màn hình này
1. Mục 1 và 2 (Hội thoại) cùng nút Câu trả lời nhanh, vì đây là màn dùng nhiều nhất.
2. Mục 3 (Thư viện trả lời).
3. Mục 4 (Cài đặt hiển thị), vì ảnh hưởng token màu toàn bộ.
4. Mục 5 (Lịch hẹn nhắc).
5. Mục 6 (Kênh kết nối).
