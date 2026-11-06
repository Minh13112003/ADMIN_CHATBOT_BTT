# Giao việc: Cài đặt giao diện (sáng/tối/chủ đề) và biểu đồ thống kê

Dành cho ChatGPT/Codex. Trang quản trị chat của BenThanh Tourist: `D:\btt-chat-admin` (NestJS 11, Prisma 7, React 19, Vite 8, Tailwind 4, SWR).

**Trước khi làm:** đọc `CLAUDE.md` và toàn bộ `.claude/rules/` (nhất là `guardrails.md`, `frontend.md`, `business-rules.md`). Không đọc, in hay commit `.env`. Không commit, không push. Không chạy `prisma migrate reset`, `db push`, `pnpm smoke`, `pnpm simulate` trên Supabase thật. Dùng `pnpm`. Xong chạy `pnpm typecheck`, `pnpm test`, `pnpm build` rồi báo thật phần nào đã kiểm tra, phần nào chưa.

Chữ giao diện là tiếng Việt có dấu. Không dùng emoji. Không dùng `alert`/`confirm` của trình duyệt (dùng `Dialog` trong `frontend/src/components/ui.tsx`).

---

## Bước 0. Nghiên cứu trước khi thiết kế (bắt buộc, làm cho cả Phần A và Phần B)

Trước khi viết code, đọc các trang tham khảo ở mục "Nguồn GitHub nên đọc" (trong Phần A, mục "Quy tắc thiết kế UI/UX") và rút ra **5 đến 8 quy tắc thật sự áp dụng được** cho trang này: sale dùng cả ngày, nhiều tin nhắn và danh sách, chữ tiếng Việt có dấu, dùng trên máy tính và điện thoại 390 px. Ghi ngắn gọn vào đầu mô tả thay đổi: quy tắc nào, lấy từ nguồn nào, áp dụng ở đâu.

Nguyên tắc chọn: **chỉ áp dụng cái giúp app này dễ dùng hơn**, không làm theo cho đủ. Quy tắc nào mâu thuẫn với quy tắc của dự án (`.claude/rules/frontend.md`: nút chính tối thiểu 44 px, cột thông tin khách đóng sẵn, màu đỏ thương hiệu `#D0021B`, font Be Vietnam Pro) thì giữ quy tắc của dự án và ghi chú lý do. Không đổi bố cục khung chat đã được duyệt, chỉ thêm cài đặt và biểu đồ.

## Phần A. Trang Cài đặt: sáng, tối, theo hệ thống, chủ đề màu

### Mục tiêu
Trang `/settings` cho **cả sale và admin** (không phải `AdminOnly`), mở từ menu tròn của người dùng ở góc phải trên (`Shell.tsx`) và từ thanh điều hướng. Người dùng chọn:
1. **Chế độ:** Sáng / Tối / Theo hệ thống (mặc định: theo hệ thống).
2. **Chủ đề màu (màu nhấn):** Đỏ BenThanh (mặc định, `#D0021B`), Xanh dương, Xanh lá, Tím. Chỉ đổi màu nhấn (nút chính, trạng thái đang chọn, thanh bên), không đổi màu trạng thái hội thoại.
3. **Cỡ chữ:** Nhỏ / Vừa (mặc định) / Lớn (đổi `font-size` của `html`: 14, 16, 18 px; toàn bộ giao diện dùng `rem` nên co giãn theo).
4. **Mật độ:** Thoáng / Gọn (đổi khoảng cách danh sách hội thoại).
5. **Giảm chuyển động** (tắt hiệu ứng `.ping`, mặc định theo `prefers-reduced-motion`).
6. Nút **Khôi phục mặc định**.

Lưu ở `localStorage` (bọc `try/catch`: trình duyệt riêng tư có thể chặn). Chưa cần lưu lên server. Áp dụng ngay khi chọn, không cần tải lại.

### Cách làm kỹ thuật (quan trọng)
- Màu hiện nằm trong `@theme` ở `frontend/src/globals.css` (`--color-brand`, `--color-ink`, `--color-page`, `--color-line`, `--color-fill`...). Tailwind 4 sinh class từ các biến này và đọc lại biến ở lúc chạy, nên **chỉ cần ghi đè biến** trong `:root[data-theme='dark']` và `:root[data-accent='blue']`... là cả giao diện đổi theo. Không viết lại component.
- **Việc dọn trước:** có khoảng 25 chỗ trong 7 file `.tsx` dùng màu cứng dạng `bg-[#e9ecf2]`, `text-[#3f4754]`, `bg-[#fdecec]`... (tìm bằng `grep -rE "\[#[0-9a-fA-F]{3,8}\]" frontend/src`). Mỗi chỗ phải đổi thành token (thêm token mới vào `@theme` nếu thiếu), nếu không chế độ tối sẽ có mảng sáng chói. Thêm cả màu trong `globals.css` đang dùng `#d0021b66` cho hiệu ứng `.ping`.
- **Tránh nháy trắng khi tải trang:** thêm đoạn script nhỏ đồng bộ trong `frontend/index.html` (trước khi React chạy) đọc `localStorage` và đặt `data-theme`, `data-accent`, cỡ chữ lên `<html>`. Thêm `<meta name="color-scheme" content="light dark">`.
- Chế độ "Theo hệ thống": nghe `matchMedia('(prefers-color-scheme: dark)')` và cập nhật khi hệ điều hành đổi.
- Tạo `frontend/src/lib/theme.ts` (hàm thuần: đọc, ghi, áp dụng, kèm test nếu có chỗ để chạy test frontend; hiện backend mới có jest) và `frontend/src/pages/SettingsPage.tsx`. Đăng ký đường dẫn ở `App.tsx` trong `WorkspaceLayout`.
- Thành phần chọn: dùng `Segmented` trong `ui.tsx` cho chế độ, cỡ chữ, mật độ; ô chọn màu là nhóm nút tròn có `aria-pressed` và nhãn chữ; công tắc dùng `Switch`.

### Bảng màu chế độ tối đề nghị (kiểm tra lại độ tương phản)
| Token | Sáng (hiện tại) | Tối (đề nghị) |
|---|---|---|
| `--color-page` | `#f5f6fa` | `#0f1115` |
| nền thẻ/khung (`bg-white` đang dùng nhiều nơi: đổi sang token `--color-surface`) | `#ffffff` | `#181b21` |
| `--color-ink` | `#1a1a2e` | `#e8eaf0` |
| `--color-body` | `#4a5260` | `#b4bbc8` |
| `--color-muted` | `#5b6472` | `#98a1b0` |
| `--color-line` | `#e4e7ee` | `#2a2f39` |
| `--color-field` | `#d5d9e2` | `#3a404c` |
| `--color-fill` | `#f1f3f7` | `#1f232b` |
| `--color-brand` (chữ và viền trên nền tối) | `#d0021b` | `#ff5a6b` |
| nền nút chính | `#d0021b` | `#d0021b` giữ nguyên, chữ trắng |
| `--color-auto` / `--color-auto-soft` / `--color-auto-ink` (vàng trả lời tự động) | `#fff1cc` / `#fff6dd` / `#5c3d00` | `#3a2f10` / `#2c2410` / `#ffd980` |

Thanh bên đỏ đậm `--color-brand-dark` giữ nguyên ở cả hai chế độ. Mỗi chủ đề màu cần cặp màu cho chế độ sáng và tối.

### Quy tắc thiết kế UI/UX phải theo (dùng làm tiêu chí nghiệm thu)
Áp dụng các chuẩn đã được công nhận (tự đối chiếu với tài liệu gốc, tôi chưa dẫn link cụ thể):
- **W3C WCAG 2.2 mức AA:** chữ thường đạt tỷ lệ tương phản ít nhất 4.5:1, chữ lớn và biểu tượng 3:1, cả chế độ sáng và tối. Trạng thái không chỉ truyền bằng màu (luôn kèm chữ hoặc biểu tượng). Vùng chạm tối thiểu 24 px (dự án đặt 44 px cho nút chính, giữ nguyên). Hiện vòng focus rõ (đã có trong `globals.css`).
- **Material Design 3 (dark theme):** nền tối không dùng đen tuyền `#000`, dùng xám đậm; phân tầng bằng độ sáng của nền thay vì bóng đổ; giảm độ bão hoà của màu nhấn trên nền tối.
- **Apple Human Interface Guidelines:** tôn trọng cài đặt hệ thống (chế độ tối, cỡ chữ, giảm chuyển động); phản hồi tức thời khi chọn.
- **10 nguyên tắc dễ dùng của Nielsen:** trạng thái hệ thống luôn hiển thị (đang tải, rỗng, lỗi cho mọi danh sách), nhất quán, giúp người dùng khôi phục (nút Khôi phục mặc định).
- **Nguồn GitHub nên đọc** (tìm được ngày 2026-11-06, chỉ mới xem tiêu đề và mô tả, chưa đọc kỹ từng trang):
  - https://github.com/github/annotation-toolkit/blob/main/checklists/designer-checklist.md : danh sách kiểm tra dễ tiếp cận cho nhà thiết kế của GitHub, dựa trên WCAG 2.2 mức A và AA (màu, tiêu đề, nội dung, biểu mẫu, bố cục). Dùng làm tiêu chí nghiệm thu chính.
  - https://github.com/designdetails-io/awesome-ui-ux : tổng hợp chuẩn thiết kế của Apple, Google, Microsoft, IBM, GOV.UK.
  - https://github.com/klaufel/awesome-design-systems : danh sách hệ thống thiết kế và công cụ kiểm tra tiếp cận (axe DevTools, Pa11y, WAVE).
  - https://github.com/anubhavsrivastava/awesome-ux-design-styles và https://github.com/streamich/awesome-styleguides : danh sách bộ quy chuẩn giao diện để tham khảo.
  Khi dùng, ghi rõ nguồn trong mô tả thay đổi, không chép nguyên văn; đối chiếu chi tiết WCAG với tài liệu gốc của W3C.

### Nghiệm thu
- Bật chế độ tối: mở lần lượt `/inbox` (có tin khách, bot, nhân viên, log nội bộ, ảnh, thẻ tour), `/customers`, `/templates`, `/stats`, `/accounts`, `/settings`. Không còn mảng nền sáng, chữ nào mờ không đọc được.
- Tải lại trang ở chế độ tối không nháy trắng.
- Xem ở 1440 px và 390 px, không tràn ngang.
- Dùng bàn phím đi qua được toàn bộ trang Cài đặt.

---

## Phần B. Trang Thống kê: biểu đồ cột, biểu đồ chấm, biểu đồ tròn

### Hiện trạng
`backend/src/stats/stats.service.ts` trả số tổng theo kỳ (`today`, `week`, `month`, `all`), lưu tạm 5 phút. `frontend/src/pages/StatsPage.tsx` hiện bảng và thẻ số, **chưa có biểu đồ nào**. Quy tắc: thống kê **không được quét bảng `messages`** (sẽ có hàng triệu dòng): dùng cột tổng hợp như `conversations.lastCustomerMessageAt`, bảng `deals`, `contact_responses`, `ai_usage`. Giờ tính theo giờ Việt Nam (UTC+7), xem hàm `dauKy`.

### Cần làm
1. **Backend: endpoint mới `GET /stats/series`** (`@Roles(Role.ADMIN)` như `/stats`). Tham số: `granularity` = `day` | `week` | `month` | `quarter`, và `periods` (số mốc gần nhất, mặc định: 14 ngày, 12 tuần, 12 tháng, 8 quý). Trả mảng mốc theo thứ tự thời gian, **kể cả mốc không có dữ liệu (số 0)** để biểu đồ không bị hở:
   `[{ start: ISO, label: "06/11", customers, contacts, deals, revenue, costVnd }]`
   - `customers`: số khách nhắn tin trong mốc (dùng `lastCustomerMessageAt`).
   - `contacts`: số lần khách đòi gặp nhân viên (`contact_responses` hoặc `contactRequestedAt`, chọn cách không quét `messages`).
   - `deals` và `revenue`: chỉ đơn `status = CONFIRMED` và `voidedAt IS NULL` (khớp quy tắc doanh thu hiện có, tính theo `closedAt`).
   - `costVnd`: chi phí AI quy ra tiền Việt (`ai_usage` × giá cấu hình, xem cách tính ở `stats.service.ts`).
   - Gom nhóm bằng SQL (`date_trunc` theo múi `Asia/Ho_Chi_Minh`, quý dùng `date_trunc('quarter', ...)`), không kéo dữ liệu về rồi tự đếm. Lưu tạm 5 phút theo tham số như `/stats`.
   - Viết hàm thuần tính danh sách mốc (đầu mốc, nhãn, số mốc) ở `backend/src/common/` kèm test `.spec.ts` (nhất là biên tuần bắt đầu thứ Hai, biên quý, năm nhuận, giờ UTC+7).
2. **Backend: chi phí theo 3 nguồn** (`GET /stats/cost-by-source`, cùng tham số kỳ): trả `[{ source: 'AI' | 'ZALO' | 'FACEBOOK', costVnd, share }]`.
   - `AI` (chatbot bttAI trên App, Web, Mini App): chi phí Gemini, cộng từ `ai_usage` qua `conversationId` sang `conversations.channel` thuộc `APP`/`WEB`.
   - `ZALO`, `FACEBOOK`: **hiện chưa nối nên chi phí thật chưa có**: trả 0 và đánh dấu `connected: false` để giao diện ghi "Chưa kết nối" thay vì vẽ lát bằng 0. Khi nối kênh (skill `add-channel`), chi phí Zalo gồm tin ngoài khung 48 giờ (khoảng 55 đ/tin theo ghi chú nghiên cứu trong `integrations.md`, cần xác minh với tài liệu Zalo) và Facebook thường miễn phí.
3. **Frontend, trang Thống kê:** thêm
   - **Biểu đồ cột dọc:** doanh thu theo mốc (và chuyển nhanh sang số đơn).
   - **Biểu đồ chấm** (đường nối các chấm): số khách nhắn tin và số yêu cầu gặp nhân viên theo mốc, hai chuỗi cùng một biểu đồ, chú giải rõ.
   - Bộ chọn **Ngày / Tuần / Tháng / Quý** (dùng `Segmented`) điều khiển cả hai biểu đồ.
   - **Biểu đồ tròn** (kiểu vành khuyên): tỷ lệ chi phí 3 nguồn AI, Zalo, Facebook, kèm số tiền và phần trăm ở chú giải; nguồn chưa kết nối ghi "Chưa kết nối".
4. **Cách vẽ:** ưu tiên SVG tự viết hoặc thư viện nhỏ `recharts` 3.x (kiểm tra tương thích React 19 trước khi cài). Màu dùng token của giao diện (đọc biến CSS) để chạy đúng ở chế độ tối của Phần A. Mỗi nguồn trong biểu đồ tròn có **màu + nhãn chữ** (không chỉ dựa vào màu). Biểu đồ phải có: tiêu đề, đơn vị (đ, triệu đ), trục có số, chú thích khi rê chuột hoặc chạm, trạng thái đang tải, rỗng ("Chưa có dữ liệu trong kỳ này") và lỗi. Dùng được ở 390 px (biểu đồ co theo chiều ngang, cho phép cuộn ngang trong khung biểu đồ riêng chứ không làm tràn cả trang). Thêm bảng số liệu ẩn cho trình đọc màn hình (`<table class="sr-only">`) hoặc `aria-label` mô tả.
5. Dùng chung định dạng tiền ở `lib/labels.ts` (`dinhDangSo`, `trieu`).

### Nghiệm thu
- Chuyển Ngày/Tuần/Tháng/Quý thì biểu đồ đổi đúng, mốc trống hiện 0.
- Số liệu biểu đồ khớp số tổng hiện có của trang (cộng doanh thu các cột trong kỳ bằng tổng doanh thu cùng kỳ, trừ khác biệt do mốc đầu/cuối).
- Đo thời gian trả lời của `/stats/series` trên database thử có 1 triệu tin nhắn: không quét `messages`, nên phải ở mức vài chục mili giây.
- Đơn chờ xác nhận không cộng vào doanh thu; đơn bị huỷ không cộng.
- Xem ở 1440 px và 390 px, cả chế độ sáng và tối; không lỗi console.
