# Câu trả lời nhanh + Hội thoại điện thoại bản mới (đọc từ bản vẽ Stitch)

Dành cho Codex/ChatGPT. Ảnh chuẩn trong thư mục này:
- `cau-tra-loi-nhanh-may-tinh.png`: máy tính 1440 px, hộp thoại Câu trả lời nhanh (có thanh bên MỚI).
- `hoi-thoai-dien-thoai-moi.png`: hai trạng thái điện thoại 390 px cạnh nhau (Hội thoại có thanh tab dưới; Câu trả lời nhanh toàn màn hình kèm bottom sheet).

Hai ảnh này **thay thế** `hoi-thoai-may-tinh.*` và `hoi-thoai-dien-thoai.*` (bản cũ, tab đỏ) ở phần ô soạn tin, nút Câu trả lời nhanh, thanh tab dưới. Bố cục 3 cột của Hội thoại vẫn theo `hoi-thoai-may-tinh.png` và `docs/giao-dien-tu-stitch.md` mục 4. Thanh bên: `THANH-BEN-MOI.md`. **Chỉ là bản vẽ: viết lại bằng React và token của dự án, không chép HTML Stitch (dùng Tailwind CDN, font nạp từ Google).**

## A. Nút Câu trả lời nhanh trong ô soạn tin
- Hàng soạn tin, trái sang phải: nút đính kèm, ô nhập, **nút tia sét (icon `bolt`)**, nút Gửi đỏ.
- Bản vẽ máy tính vẽ nút tia sét **viền đỏ 2 px nền `#FDECEC` icon đỏ**, bản điện thoại vẽ **viền xám mảnh, icon vàng**: không thống nhất. **Chọn một kiểu cho cả hai:** vuông 44 px, viền mảnh `line`, nền trắng, icon màu thương hiệu; rê chuột hoặc đang mở thì nền `#FDECEC`. Có `aria-label` và tooltip "Câu trả lời nhanh".
- Điện thoại **không có hàng chip mẫu** phía trên ô nhập. Máy tính có thể giữ tối đa 2 chip.
- Gõ `/` trong ô nhập mở nhanh bảng này (tuỳ chọn, ghi trong mô tả; không bắt buộc ở pha đầu).

## B. Máy tính: hộp thoại giữa màn hình
- Nền tối mờ phủ cả trang (kể cả thanh bên); hộp trắng **rộng 720 px**, bo 16 px, cao tối đa 80% màn hình, cuộn bên trong.
- **Đầu hộp:** ô icon sét nền `#FDECEC`, tiêu đề **"Câu trả lời nhanh"**, dòng phụ "Chọn mẫu câu để chèn ngay vào khung hội thoại", nút đóng X.
- **Ô tìm** "Tìm theo tiêu đề hoặc nội dung..." (không phân biệt dấu), cạnh đó chip lọc.
- **Bảng 2 cột**, tiêu đề cột dính trên cùng: **Tiêu đề** (1/3) và **Nội dung mẫu** (2/3) + cột nút con mắt cuối dòng. Mỗi dòng cao tối thiểu 56 px: tiêu đề đậm **một dòng cắt "..."**; nội dung xem trước **tối đa 2 dòng cắt "..."** (`line-clamp-2`); **nút con mắt** 32 px bên phải (`aria-label` "Xem toàn bộ nội dung"). Dòng đang rê chuột/chọn bằng bàn phím: nền `#FDECEC`, thanh đỏ 4 px bên trái.
- **Chân hộp:** gợi ý ngắn và nút "Quản lý mẫu câu" (đi tới `/templates`).
- **Bấm con mắt:** hiện **hộp nhỏ chồng lên** (bản vẽ đặt bên phải hộp chính, rộng 420 px, viền đỏ): tiêu đề "Toàn bộ nội dung mẫu", tên mẫu, **toàn văn không cắt** (có thanh cuộn khi dài), nút **"Đóng"** và nút đỏ **"Dùng mẫu này"**. Bản vẽ gắn icon "send" cho nút này: **bỏ icon send** vì nút chỉ chèn vào ô nhập, không gửi.
- **Bấm dòng (không phải con mắt)** hoặc "Dùng mẫu này": chèn nội dung vào ô nhập tại con trỏ, đóng hộp, đưa con trỏ về ô nhập. **Không tự gửi.** Bấm con mắt không được chèn.
- Bàn phím: mũi tên lên/xuống chọn dòng, Enter chèn, Esc đóng (đóng hộp xem toàn văn trước, rồi mới đóng bảng).

## C. Điện thoại: toàn màn hình (trạng thái 2)
- Phủ **toàn màn hình**, che hết khung chat và thanh tab dưới. Thanh trên: nút X, tiêu đề "Câu trả lời nhanh", chip số mẫu ("6 mẫu").
- Ô tìm cao 40 px; bên dưới hàng chip lọc cuộn ngang.
- Danh sách, **mỗi dòng cao tối thiểu 64 px**: tiêu đề đậm ở trên, **nội dung 2 dòng cắt "..."** bên dưới, **nút con mắt tròn 36 px** bên phải. Đủ vùng chạm 44 px (mở rộng vùng bấm).
- **Bấm con mắt** mở **bottom sheet** từ dưới lên (nền tối mờ phía sau, bo góc trên 24 px, thanh nắm kéo, cao tối đa khoảng 45% màn hình): tên mẫu, toàn văn trong khung cuộn, hai nút cao 44 px: **"Đóng"** và **"Dùng mẫu này"** (đỏ, không icon send).
- Bấm dòng: chèn vào ô nhập, đóng toàn màn hình, quay về chat.

## D. Điện thoại: Hội thoại (trạng thái 1) và thanh tab dưới
- **Thanh trên:** nút quay lại, avatar (chấm xanh khi khách đang trực tuyến chỉ nếu có dữ liệu thật), tên khách **một dòng cắt "..."**, dòng nhỏ "SĐT • kênh", nút `⋯`. Chip "Yêu cầu NV" cạnh tên chỉ hiện khi khách đòi gặp người.
- **Dải "Cần làm" một dòng**, cao 40 px: chữ cắt "...", hai nút nhỏ "Gọi khách", "Xác nhận đơn" (vùng chạm vẫn đủ 44 px bằng đệm).
- **Bong bóng:** khách trái nền trắng viền; bot nhãn "bttAI Bot"; nhân viên phải nền `#FDECEC` viền đỏ nhạt, ghi "đã xem" nếu có dữ liệu. Tối đa 85% bề rộng.
- **Thanh tab dưới 56 px, 5 mục:** Hội thoại (huy hiệu đỏ số khách đang chờ, đang chọn màu `#B30118`, icon đặc), Khách hàng, Đơn tour, Hẹn, Thêm. Nhãn tab ở bản vẽ rất nhỏ (10 px): để **tối thiểu 11 px**, một dòng. "Thêm" mở bottom sheet liệt kê mục còn lại (Thư viện trả lời, Cài đặt hiển thị, nhóm QUẢN TRỊ nếu là admin).
- Thanh tab dưới **ẩn khi đang ở khung chat?** Bản vẽ mới **vẫn hiện** thanh tab dưới ngay cả trong khung chat. **Làm theo bản vẽ mới:** hiện thanh tab dưới ở cả danh sách và khung chat; ẩn khi mở bảng Câu trả lời nhanh toàn màn hình và khi bàn phím điện thoại mở.
- Khung viền điện thoại, thanh trạng thái 9:41, "dynamic island" chỉ là minh hoạ: **không làm**.

## E. Dữ liệu, chỗ nào đã có, chỗ nào chưa
- Dùng `GET /templates` (`title`, `body`). **Không đổi database.**
- Trong bản vẽ có những thứ **backend chưa có**, **không làm ở pha này**: phím tắt `/bg-eu`, `/visa`..., nhãn lọc (Tour Tết, Visa, Báo giá, Cọc tour), "Phổ biến", "148 lượt dùng". Hàng chip lọc ở hộp: **bỏ**, hoặc chỉ giữ "Tất cả (số mẫu)". Tiêu đề mẫu hiển thị đúng `title`, **không** thêm tiền tố `/mã`.
- **Biến trong nội dung** (`{tên khách}`, `{tên nhân viên}`, `{số tiền cọc}`, `{tên tour}`, `{thời gian hẹn}`): lúc chèn vào ô nhập, **thay ở frontend** những biến biết chắc (`{tên khách}` từ hội thoại đang mở, `{tên nhân viên}` từ tài khoản đang đăng nhập). Biến không biết thì **để nguyên chữ trong ngoặc** để nhân viên tự điền, không bỏ trống, không báo lỗi. Hàm thay thế là hàm thuần ở `frontend/src/lib/` có test.
- Số liệu, tên khách (Trần Hoàng Bách), tour, giá, "VIP Bạc", "BTT-SALE-104", "99.8%", ảnh `gstatic.com`: **dữ liệu giả, không đưa vào code**.
- Trạng thái bắt buộc: đang tải (khung xám nhấp nháy), rỗng ("Chưa có mẫu nào" + nút tới `/templates`), lỗi (nút "Thử lại"), tìm không ra ("Không tìm thấy mẫu phù hợp").

## F. Nghiệm thu riêng
1. Máy tính 1440 px và điện thoại 390 px: mở được bảng, tìm được, bấm dòng chèn đúng vào ô nhập và không tự gửi; con mắt không chèn.
2. Nội dung dài hiển thị "..." ở bảng và đầy đủ ở hộp xem toàn văn.
3. Esc, Enter, mũi tên dùng được; trả focus về ô nhập khi đóng.
4. `{tên khách}` được thay đúng; biến lạ để nguyên.
5. Không tràn ngang ở 390 px; nút chạm tối thiểu 44 px; không emoji; chữ có dấu.
6. `pnpm typecheck`, `pnpm test`, `pnpm build` đạt; gửi tin, ảnh/PDF, khoá nhắn vẫn chạy.
