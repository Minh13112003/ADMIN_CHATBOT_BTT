# Giao việc: Chuyển thiết kế Stitch thành giao diện thật

Dành cho Codex/ChatGPT. Trang quản trị chat BenThanh Tourist: `D:\btt-chat-admin` (React 19, Vite 8, Tailwind 4, SWR, NestJS 11).

**Trước khi làm:** đọc `CLAUDE.md` và toàn bộ `.claude/rules/` (nhất là `guardrails.md`, `frontend.md`, `business-rules.md`), và đọc `docs/giao-dien-cai-dat-va-bieu-do.md` (Bước 0 nghiên cứu UI/UX, Phần A cài đặt giao diện, Phần B biểu đồ thống kê). Không đọc hay in `.env`, không commit, không push. Chữ tiếng Việt có dấu, không emoji, không `alert`/`confirm`. Xong chạy `pnpm typecheck`, `pnpm test`, `pnpm build`, xem ở 1440 px và 390 px, báo thật phần nào đã kiểm tra.

## 1. Thiết kế nằm ở đâu

- **Stitch (Google):** dự án "BenThanh Tourist Omnichannel Workspace", mã `5451236824423667128`, hệ thống thiết kế "Heritage Travel Concierge Workspace". Codex không gọi được Stitch, nên dùng các nguồn dưới đây.
- **Mã HTML đã tải về** (mở bằng trình duyệt để xem đúng bố cục; dùng Tailwind CDN): `docs/stitch/`
  Xem danh sách đầy đủ và file nào còn tab đỏ cũ ở `docs/stitch/THANH-BEN-MOI.md` (mục "QUY TẮC BẮT BUỘC").
- **Câu trả lời nhanh + Hội thoại điện thoại bản mới: `docs/stitch/CAU-TRA-LOI-NHANH.md` (kèm 2 ảnh chuẩn `cau-tra-loi-nhanh-may-tinh.png`, `hoi-thoai-dien-thoai-moi.png`). Mục 3 và mục "Điện thoại" ở dưới nếu mâu thuẫn thì theo file này.**
- **Thanh bên (tab) MỚI, chuẩn duy nhất: `docs/stitch/THANH-BEN-MOI.md` + `docs/stitch/thanh-ben-moi.html`. Ảnh hay HTML nào còn thanh bên đỏ hẹp là bản cũ, bỏ qua.** Thêm: `docs/stitch/kenh-ket-noi.html` / `.png` (màn Kênh kết nối bản mới) và `DESIGN-heritage-travel.md` (hệ thiết kế của Stitch, chỉ tham khảo).
- **Mô tả chi tiết 6 màn hình còn lại (bố cục, kích thước, trạng thái, dữ liệu): `docs/stitch/6-man-hinh-con-lai.md`. Đọc file này trước khi làm các màn đó.**
- **6 màn hình chưa có file HTML** vì công cụ không ghi được ra đĩa: Hội thoại (máy tính), Hội thoại (điện thoại), Mẫu nhanh, Cài đặt hiển thị, Lịch hẹn nhắc, Kênh kết nối. Với các màn này hãy dùng **mô tả ở mục 4** và ảnh chụp mà chủ dự án đưa kèm. Nếu chủ dự án xuất HTML từ Stitch (mở màn hình, chọn Code/Export) thì đặt vào `docs/stitch/` cùng tên.
- **Quan trọng:** HTML của Stitch chỉ là **bản vẽ tham khảo**. Không chép nguyên: viết lại bằng component React và token của dự án. Số liệu, tên người, thương hiệu trong bản vẽ là **dữ liệu giả**, không đưa vào code.

## 2. Quy tắc chuyển đổi

1. **Giữ token và font của dự án** (`frontend/src/globals.css`, Be Vietnam Pro). Stitch dùng Inter hoặc Plus Jakarta Sans: không đổi font vì dự án đã chọn Be Vietnam Pro để dấu tiếng Việt đúng. Màu theo bản vẽ: đỏ `#D0021B`, đỏ đậm `#B30118`, nền cát `#FAF9F6`, viền `#E6E2DA`, nền mục đang chọn `#FDECEC`. Đưa màu mới vào `@theme` thành token, không viết màu cứng trong component (để chế độ tối ở Phần A chạy được).
2. **Thanh bên mới (thay thanh bên đỏ hẹp hiện nay):** thanh sáng, rộng 248 px, nền trắng, viền phải `#E6E2DA`. Trên cùng: logo `frontend/public/logo.png` cạnh chữ **BENTHANH TOURIST** và dòng nhỏ "Quản trị hội thoại & tour". Nhóm **BẢNG ĐIỀU KHIỂN** (một dòng mỗi mục, icon trái, nhãn không xuống dòng, cao 44 px): Hội thoại (huy hiệu đỏ số khách đang chờ), Khách hàng, Đơn đặt tour, Lịch hẹn nhắc, Thư viện trả lời, Cài đặt hiển thị. Nhóm **QUẢN TRỊ (ADMIN)**, chỉ admin thấy: Thống kê, Hiệu suất sale, Kênh kết nối, Quản trị tài khoản. Mục đang chọn: nền `#FDECEC`, chữ `#B30118`, thanh đỏ 3 px bên trái, đậm. Dưới cùng: thẻ nhỏ trạng thái "Kênh bttAI, Hoạt động" lấy từ `/health` hoặc kết nối socket (không ghi số 99.8% cố định).
   - Đường dẫn: `/inbox`, `/customers`, `/deals`, `/reminders`, `/templates`, `/settings` | `/stats`, `/performance`, `/channels`, `/accounts` (nhóm sau dùng `AdminOnly` đã có trong `App.tsx`).
   - **Điện thoại (dưới 768 px):** không dùng thanh bên. Thanh tab dưới 5 mục: Hội thoại, Khách hàng, Đơn tour, Hẹn, Thêm. "Thêm" mở danh sách các mục còn lại. Mỗi lần chỉ hiện một khung: danh sách, rồi chat, rồi hồ sơ khách mở dạng ngăn kéo từ dưới (bottom sheet).
3. **Thanh trên cùng gọn:** tên trang, chấm xanh "Đang kết nối", chuông, menu avatar (đổi mật khẩu, đăng xuất). Bỏ đồng hồ GMT và các chip kênh dài.
4. Làm theo **từng pha**, mỗi pha một thay đổi nhỏ chạy được: (1) token + thanh bên + thanh tab điện thoại; (2) Hội thoại (header, dải "Cần làm", panel 3 tab, nút câu trả lời nhanh); (3) Thư viện trả lời; (4) Khách hàng và Quản trị tài khoản; (5) Đơn đặt tour và Lịch hẹn nhắc; (6) Thống kê, Hiệu suất sale, Kênh kết nối; (7) Cài đặt hiển thị. Phần chưa có API thì làm giao diện với trạng thái "đang tải / rỗng / lỗi" và ghi rõ trong mô tả.

## 3. Nút "Câu trả lời nhanh" (yêu cầu mới của chủ dự án, làm ở pha 2)

**Vị trí:** ô soạn tin, hàng từ trái sang phải: nút đính kèm, ô nhập, **nút Câu trả lời nhanh (icon tia sét, 44 px, viền mảnh, có `aria-label` và tooltip "Câu trả lời nhanh")**, nút **Gửi** đỏ. Ở điện thoại bỏ hàng chip mẫu phía trên để dành chỗ.

**Khi bấm:**
- **Điện thoại:** mở **toàn màn hình**, che hết khung chat. Tiêu đề có nút đóng (X), tên "Câu trả lời nhanh", ô tìm "Tìm theo tiêu đề hoặc nội dung".
- **Máy tính:** hộp thoại giữa màn hình rộng khoảng 720 px, cao tối đa 80% màn hình, cuộn bên trong.
- **Bảng hai cột "Tiêu đề" và "Nội dung"** (kiểu Pancake). Mỗi dòng: tiêu đề in đậm một dòng; nội dung xem trước **tối đa 2 dòng, quá dài thì kết thúc bằng "..."** (`line-clamp-2`); bên phải là **nút hình con mắt** (`aria-label` "Xem toàn bộ nội dung"). Dòng cao tối thiểu 56 px. Ở điện thoại, hai cột xếp thành một dòng: tiêu đề trên, nội dung dưới.
- **Bấm nút con mắt:** mở hộp nhỏ hiện **toàn bộ nội dung** của mẫu đó (không cắt, có thanh cuộn), kèm nút "Đóng" và "Dùng mẫu này" (đỏ). Bấm con mắt không được chèn mẫu vào ô nhập.
- **Bấm vào dòng (ngoài nút con mắt):** chèn nội dung vào ô nhập ở con trỏ (hoặc thay phần đang soạn nếu ô trống), **đóng bảng**, đưa con trỏ về ô nhập. Không tự gửi.
- Có trạng thái đang tải, rỗng ("Chưa có mẫu nào", kèm nút tới trang Thư viện trả lời), lỗi. Tìm không phân biệt dấu. Dùng bàn phím được (Esc đóng, Enter chọn).
- **Dữ liệu:** API hiện có `GET /templates` (tiêu đề `title`, nội dung `body`). Dùng lại, không cần đổi bảng. Các biến như `{tên khách}` trong bản vẽ **chưa có trong backend**: pha sau nếu cần thì thay biến ở frontend lúc chèn (tên khách, tên nhân viên), ghi rõ.
- Thay luôn hàng chip mẫu hiện có bằng nút này trên điện thoại; trên máy tính có thể giữ tối đa 2 chip.

## 4. Mô tả từng màn hình

Tham chiếu: ảnh chụp và mã HTML ở mục 1. Mọi màn hình dùng thanh bên mục 2 và co về bố cục điện thoại ở dưới 768 px.

- **Hội thoại (`/inbox`):** 3 cột, danh sách 340 px, khung chat linh hoạt (tối thiểu 480 px), hồ sơ khách 360 px; dưới 1280 px cột phải thành ngăn trượt. Tiêu đề khung chat **đúng một hàng**: avatar, tên và SĐT bên dưới, chip kênh, chip trạng thái; bên phải **một nút chính đỏ "Chốt tour"** và nút `⋯` (menu "Chuyển cho đồng nghiệp" kèm ghi chú, "Trả lại cho bot", "Xem hồ sơ khách"). Bỏ nút "Bàn giao ca" riêng (đã có "Chuyển cho đồng nghiệp"). Gộp banner "khách đòi gặp nhân viên" và thẻ đơn chờ xác nhận thành **một dải "Cần làm"** một dòng với hai nút "Gọi khách", "Xác nhận đơn". Cột phải **chia 3 tab: Khách, Đơn tour, Hẹn & ghi chú**, mỗi lần chỉ hiện một tab (nội dung hiện có của `InfoPanel.tsx` chia lại cho 3 tab, không bỏ chức năng). Bong bóng tối đa 70% bề rộng. Giữ toàn bộ logic hiện có (khoá nhắn, hỏi lại khi trùng, "đang soạn", gửi ảnh/PDF, trích tin).
- **Thư viện trả lời (`/templates`, đổi tên hiển thị từ "Mẫu nhanh"):** hai tab "Mẫu trả lời nhanh" và "Quy tắc trả lời tự động" (hiện là hai khối trên một trang). Cột trái 360 px danh sách mẫu có ô tìm và nút "+ Thêm mẫu"; cột phải trình chỉnh sửa (tiêu đề, nội dung, đếm ký tự, nút Lưu, Xoá hai lần bấm) và khung xem trước tin như khách thấy; bảng quy tắc tự động có công tắc bật/tắt. **Không làm** phím tắt `/bg-eu`, nhãn `#tag`, "Dùng N lần" nếu chưa có cột dữ liệu (cần `prisma migrate dev` và sửa `lich_su_db.py` nếu liên quan): để pha sau, ghi trong mô tả.
- **Khách hàng (`/customers`):** theo `docs/stitch/khach-hang.html`. Giữ ô tìm tên và SĐT hiện có.
- **Đơn đặt tour (`/deals`, mới):** `docs/stitch/don-dat-tour.html`. Bảng cột kiểu Kanban 3 cột: Chờ xác nhận, Đã chốt, Đã huỷ. Thẻ: tên khách, kênh, tour, mã tour, số khách, tiền, nguồn (Chatbot/Sale), người phụ trách; thẻ chờ có "Gọi khách", "Xác nhận đơn" (dùng lại `CloseDealDialog` và `CancelDealDialog` trong `InfoPanel.tsx`). Cần endpoint danh sách đơn (hiện chỉ có `GET /customers/:id/deals`): thêm `GET /deals?status=&period=` ở backend kèm test, không quét `messages`. Doanh thu chỉ cộng đơn `CONFIRMED` chưa `voidedAt`.
- **Lịch hẹn nhắc (`/reminders`, mới):** nhóm Quá hạn, Hôm nay, Ngày mai, Tuần này; mỗi mục có "Mở hội thoại", "Xong", "Dời +30 phút / +2 giờ / Sáng mai 09:00"; dải tuần ở cột phải. Dữ liệu từ `conversations.followUpAt`, `followUpNote` (đã có; bộ lọc `followUp` đã có ở `GET /conversations`). Bỏ "đồng bộ Lịch Google", "tỷ lệ chăm sóc đúng giờ 98%" (không có dữ liệu).
- **Thống kê (`/stats`):** `docs/stitch/thong-ke.html` + Phần B của `docs/giao-dien-cai-dat-va-bieu-do.md`.
- **Hiệu suất sale (`/performance`, mới, admin):** `docs/stitch/hieu-suat-sale.html`. Bảng xếp hạng sale: đang trực, số khách đang giữ, số lần trả lời, thời gian trả lời trung vị, tỷ lệ trả lời trong 5 phút, đơn đã chốt, doanh thu. Phần lớn đã có trong `/stats` (`staff.responses`, `avgSeconds`, `responseTime`); thiếu thì mở rộng `stats.service.ts`.
- **Kênh kết nối (`/channels`, mới, admin):** 4 thẻ kênh: bttAI Web, bttAI App và Mini App (đã kết nối); Zalo OA, Facebook (chưa kết nối, nút bị khoá, hiện điều kiện cần). Số tin hôm nay và thời gian phản hồi lấy từ dữ liệu thật theo kênh. **Tuyệt đối không hiển thị hay cho sao chép `INGEST_API_KEY` ra giao diện** (khoá bí mật nằm ở backend): bỏ khối "Khoá Ingest" trong bản vẽ, hoặc chỉ ghi "Đã cấu hình" / "Chưa cấu hình". Không làm "Tạo lại khoá".
- **Quản trị tài khoản (`/accounts`):** `docs/stitch/quan-tri-tai-khoan.html`. Bộ lọc Tất cả / Đang hoạt động / Đã khoá, nút "+ Tạo tài khoản" mở ngăn bên phải, menu hàng: Khoá, Mở khoá, Đặt lại mật khẩu (đã có API ở `users.controller.ts`), hộp xác nhận khoá ghi rõ "Người này bị đăng xuất ngay và các khách đang giữ được chia lại".
- **Cài đặt hiển thị (`/settings`):** Phần A của `docs/giao-dien-cai-dat-va-bieu-do.md`. Bản vẽ có thêm mục "Thông báo", "Phím tắt", "Phiên đăng nhập": chỉ làm "Giao diện" ở pha này, các mục khác ẩn hoặc ghi "Sắp có".

## 5. Không đưa vào code
Số liệu mẫu (1.042 tin, 99.8%, "BTT-SALE-104"), tên khách giả, hạng "VIP Bạc/Gold" (chưa có dữ liệu hạng), đồng bộ Lịch Google, ảnh `lh3.googleusercontent.com`, chữ "bttAI Studio", khoá Ingest, nút "Tạo lại khoá". Màu của chủ đề Xanh dương/Xanh lá/Tím trong Phần A chỉ là màu nhấn.

## 6. Nghiệm thu chung
- 1440 px và 390 px: không tràn ngang, chữ nhãn không xuống dòng lệch, chạm tối thiểu 44 px cho nút chính.
- Mọi danh sách có trạng thái đang tải, rỗng, lỗi.
- Sale không thấy nhóm QUẢN TRỊ và gõ thẳng đường dẫn admin thì bị chuyển về `/inbox`; backend vẫn kiểm tra quyền.
- `pnpm typecheck`, `pnpm test`, `pnpm build` đạt. Chức năng cũ (gửi tin, ảnh/PDF, khoá nhắn, chốt tour) vẫn chạy.
