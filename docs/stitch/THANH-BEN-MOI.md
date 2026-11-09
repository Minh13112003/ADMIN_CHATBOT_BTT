# Thanh bên (tab) MỚI: dùng cái này, bỏ tab cũ

Dành cho Codex/ChatGPT. **Mọi ảnh hoặc file Stitch còn hiện thanh bên cũ (thanh đỏ hẹp, nhãn nhiều dòng) là bản cũ: không làm theo.** Chỉ làm theo thanh bên sáng 248 px mô tả ở đây.

Bản vẽ chuẩn: `docs/stitch/thanh-ben-moi.html` (mở bằng trình duyệt; chỉ có thanh bên) và `docs/stitch/kenh-ket-noi.png` / `kenh-ket-noi.html` (thanh bên đặt trong một trang đầy đủ). Chỉ là tham khảo bố cục: viết lại bằng React + token của dự án (`frontend/src/components/Shell.tsx`), giữ font Be Vietnam Pro, không dùng Plus Jakarta Sans, không dùng Tailwind CDN, không chép SVG hoa 7 cánh (dùng `frontend/public/logo.png`).

## Kích thước và màu
- Rộng đúng 248 px, nền trắng, viền phải `#E6E2DA`, cao toàn màn hình, không co.
- Đầu thanh cao 72 px, viền dưới `#F1EFEA`: logo 36 px, chữ **BENTHANH TOURIST** (15 px, đậm), dòng nhỏ "Quản trị hội thoại & tour" (11 px, xám).
- Tiêu đề nhóm: 11 px, đậm, chữ hoa, xám nhạt, cách chữ rộng.
- Mỗi mục: cao 44 px, lề ngang 12 px, bo 8 px, icon 20 px bên trái, nhãn 13 px **không bao giờ xuống dòng** (`whitespace-nowrap`). Mục thường: chữ xám đậm; rê chuột nền `#F4F3F0`.
- Mục đang chọn: nền `#FDECEC`, chữ và icon `#B30118`, chữ đậm, **thanh đỏ 3 px bên trái**, icon dạng đặc.
- Huy hiệu đỏ tròn (`#D0021B`, chữ trắng 11 px) bên phải mục Hội thoại: số khách đang chờ (Liên hệ + Chưa xem), lấy từ dữ liệu thật, bằng 0 thì ẩn.
- Thẻ cuối thanh: nền `#F8FAF7`, viền `#E2E8F0`, bo 12 px, vòng xanh có dấu tích, "Kênh bttAI", chấm xanh "Hoạt động". Chỉ ghi "Hoạt động" khi `/health` hoặc kết nối socket thật sự ổn; lỗi thì chấm đỏ "Mất kết nối". **Không ghi số 99.8% cố định.**

## Danh sách mục (đúng thứ tự, đúng tên)

**Nhóm BẢNG ĐIỀU KHIỂN (sale và admin đều thấy)**

| # | Nhãn | Đường dẫn | Icon Material |
|---|---|---|---|
| 1 | Hội thoại | `/inbox` | chat |
| 2 | Khách hàng | `/customers` | group |
| 3 | Đơn đặt tour | `/deals` | receipt_long |
| 4 | Lịch hẹn nhắc | `/reminders` | event_note |
| 5 | Thư viện trả lời | `/templates` | bolt |
| 6 | Cài đặt hiển thị | `/settings` | tune |

**Nhóm QUẢN TRỊ (ADMIN), chỉ admin thấy**

| # | Nhãn | Đường dẫn | Icon |
|---|---|---|---|
| 7 | Thống kê | `/stats` | insights |
| 8 | Hiệu suất sale | `/performance` | trending_up |
| 9 | Kênh kết nối | `/channels` | hub |
| 10 | Quản trị tài khoản | `/accounts` | admin_panel_settings |

Icon: dùng bộ icon đang có trong dự án nếu tương đương; nếu muốn đúng bản vẽ thì cài gói icon SVG, **không** nạp Google Fonts Material Symbols từ CDN. Sale không thấy nhóm QUẢN TRỊ; gõ thẳng đường dẫn admin thì chuyển về `/inbox` (có sẵn `AdminOnly`). Backend vẫn là nơi kiểm tra quyền.

Trang `/deals`, `/reminders`, `/performance`, `/channels` là trang mới: làm khung trang trống có đủ trạng thái đang tải/rỗng/lỗi trước, rồi mới nối dữ liệu theo `docs/giao-dien-tu-stitch.md`.

## Thanh trên (đi kèm thanh bên)
Cao 72 px, nền trắng, viền dưới: bên trái tên trang (20 px, đậm) và chip "Đang kết nối" (chấm xanh, từ socket thật); bên phải chuông thông báo, avatar tròn + tên + vai trò, menu (đổi mật khẩu, đăng xuất). **Bỏ** nút "Kiểm tra kết nối", đồng hồ GMT, mã "BTT-ADMIN-01" cố định, các chip kênh dài.

## Điện thoại (dưới 768 px)
Không dùng thanh bên. Dùng **thanh tab dưới** cao 56 px, 5 mục: Hội thoại (có huy hiệu), Khách hàng, Đơn tour, Hẹn, **Thêm**. "Thêm" mở bottom sheet liệt kê các mục còn lại (Thư viện trả lời, Cài đặt hiển thị, và nhóm QUẢN TRỊ nếu là admin). Thanh tab hiện ở cả danh sách và khung chat (theo bản vẽ mới `CAU-TRA-LOI-NHANH.md` mục D); chỉ ẩn khi mở bảng Câu trả lời nhanh toàn màn hình hoặc bàn phím mở. Mỗi mục chạm tối thiểu 44 px.

## Việc cần bỏ khỏi thanh bên cũ
Thanh đỏ 76 px, nhãn 11,5 px xuống dòng, nút "Bàn giao ca" ở thanh trên, mọi mục không có trong bảng trên.

## Nghiệm thu
1440 px và 390 px không tràn ngang; chữ nhãn một dòng, không lệch; mục đang chọn đúng màu; sale không thấy nhóm admin; `pnpm typecheck`, `pnpm test`, `pnpm build` đạt.

## QUY TẮC BẮT BUỘC: thay tab đỏ cũ bằng tab mới ở MỌI màn hình

Các file HTML/ảnh dưới đây được vẽ khi còn **tab đỏ cũ** (thanh dọc đỏ `#B30118`, rộng 88 px, icon trên chữ nhỏ, nhãn xuống dòng). **Tab đỏ đó đã bị bỏ.** Khi làm bất kỳ màn nào:

1. **Bỏ qua hoàn toàn** thanh dọc đỏ 88 px và mọi thứ về nó (nhãn nhỏ dưới icon, nút "Bàn giao ca" trên thanh trên). Không chép, không "gần giống".
2. **Thay bằng** thanh bên sáng 248 px theo file này (`thanh-ben-moi.html`). Chỉ **vùng nội dung bên phải** của file HTML/ảnh là thứ cần làm theo.
3. Mục đang chọn của thanh bên đổi theo từng trang (đường dẫn trong bảng trên).
4. Chỉ cần làm thanh bên **một lần** trong `Shell.tsx`, mọi trang dùng chung. Không làm lại thanh bên trong từng trang.

| File | Thanh bên trong file | Phải làm |
|---|---|---|
| `hoi-thoai-may-tinh.html` / `.png` | **Tab đỏ cũ** | Bỏ tab đỏ, dùng tab mới; chỉ lấy bố cục 3 cột bên phải. Chưa có nút Câu trả lời nhanh: thêm theo `docs/giao-dien-tu-stitch.md` mục 3 |
| `hoi-thoai-dien-thoai.html` / `.png` (cũ) | không có | **Bản cũ, bỏ.** Dùng `hoi-thoai-dien-thoai-moi.png` + `CAU-TRA-LOI-NHANH.md` |
| `cau-tra-loi-nhanh-may-tinh.png` | Tab mới | Bản chuẩn của bảng Câu trả lời nhanh, đọc `CAU-TRA-LOI-NHANH.md` |
| `hoi-thoai-dien-thoai-moi.png` | không có (thanh tab dưới) | Bản chuẩn điện thoại, đọc `CAU-TRA-LOI-NHANH.md` |
| `mau-nhanh.html` / `.png` | **Tab đỏ cũ** | Bỏ tab đỏ, dùng tab mới; trang đổi tên "Thư viện trả lời" |
| `cai-dat-hien-thi.html` / `.png` | **Tab đỏ cũ** | Bỏ tab đỏ, dùng tab mới |
| `khach-hang.html` | **Tab đỏ cũ** | Bỏ tab đỏ, dùng tab mới |
| `quan-tri-tai-khoan.html` | **Tab đỏ cũ** | Bỏ tab đỏ, dùng tab mới |
| `thong-ke.html` | **Tab đỏ cũ** | Bỏ tab đỏ, dùng tab mới |
| `don-dat-tour.html` | Tab mới | Giữ |
| `hieu-suat-sale.html` | Tab mới | Giữ |
| `lich-hen-nhac.html` / `.png` | Tab mới | Giữ |
| `kenh-ket-noi.html` / `.png` | Tab mới | Giữ |

Nếu một ảnh và mô tả chữ mâu thuẫn về thanh bên, **luôn theo file này**.
