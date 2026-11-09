# Cách giao việc cho ChatGPT/Codex để làm đúng 100%

Dành cho chủ dự án. Làm theo thứ tự. Mỗi bước là một lần giao việc riêng: làm xong, bạn xem kết quả rồi mới sang bước sau (làm một lần quá nhiều thì dễ sai).

## Chuẩn bị (làm một lần)
1. Dùng **Codex chạy trong thư mục dự án `D:\btt-chat-admin`** (không dùng ChatGPT bản web dán chữ: nó không đọc được file và không chạy được lệnh kiểm tra). Mở dự án bằng Codex CLI/IDE để nó tự đọc được các file `.md` và ảnh.
2. Tạo nhánh riêng cho việc này: `git checkout -b giao-dien-moi` (để lỡ sai thì bỏ nhánh, không mất bản đang chạy).
3. Xoá hoặc bỏ qua file `Codex.md` ở thư mục gốc (ChatGPT tạo từ lần trước) để nó không lẫn lệnh cũ.
4. Chắc chắn các file này có trong thư mục (đã có sẵn):
   - `docs/giao-dien-tu-stitch.md` (file chính)
   - `docs/giao-dien-cai-dat-va-bieu-do.md` (cài đặt sáng/tối, biểu đồ)
   - `docs/stitch/THANH-BEN-MOI.md` (thanh bên mới, thay tab đỏ)
   - `docs/stitch/CAU-TRA-LOI-NHANH.md` (nút và bảng Câu trả lời nhanh, điện thoại)
   - `docs/stitch/6-man-hinh-con-lai.md` (mô tả các màn)
   - các file `.html` và `.png` trong `docs/stitch/`

## Tin nhắn đầu tiên (dán nguyên văn)

> Bạn là lập trình viên giao diện cho dự án `D:\btt-chat-admin` (React 19, Vite, Tailwind 4, SWR; NestJS phía sau). Tôi nói tiếng Việt, không rành kỹ thuật: trả lời bằng tiếng Việt, giải thích dễ hiểu.
>
> **Trước khi viết bất kỳ dòng code nào**, hãy đọc theo thứ tự: `CLAUDE.md`, toàn bộ `.claude/rules/`, `docs/giao-dien-tu-stitch.md`, `docs/stitch/THANH-BEN-MOI.md`, `docs/stitch/CAU-TRA-LOI-NHANH.md`, `docs/stitch/6-man-hinh-con-lai.md`, `docs/giao-dien-cai-dat-va-bieu-do.md`. Rồi mở xem các ảnh `.png` trong `docs/stitch/`.
>
> Sau khi đọc, **chưa code**. Hãy trả lời tôi: (1) tóm tắt bằng lời của bạn việc cần làm, (2) liệt kê các pha theo file chính, (3) nêu mọi chỗ trong tài liệu bạn thấy mâu thuẫn hoặc không rõ. Chờ tôi nói "bắt đầu pha 1" rồi mới làm.
>
> Quy tắc cứng: không xoá file hay dữ liệu khi tôi chưa cho phép; không đọc, in hay commit `.env`; không commit, không push; không chạy `prisma migrate reset`, `db push`, `pnpm smoke`, `pnpm simulate` vì database thật là Supabase; mọi thay đổi bảng dữ liệu phải qua `prisma migrate dev` và hỏi tôi trước; dùng pnpm; chữ tiếng Việt có dấu, không emoji, không `alert`/`confirm`. **HTML Stitch chỉ là bản vẽ tham khảo, không chép nguyên**; viết lại bằng component React và token của dự án. **Tab đỏ cũ đã bỏ, chỉ dùng thanh bên mới.**

Chờ nó trả lời. Nếu nó tóm tắt sai hoặc bỏ sót, sửa ngay ở bước này, chưa cho code.

## Giao từng pha (mỗi lần dán một đoạn)

Mỗi đoạn kết thúc bằng câu nghiệm thu giống nhau: nhờ nó chạy `pnpm typecheck`, `pnpm test`, `pnpm build` và báo **thật** phần nào đã chạy, phần nào chưa.

**Pha 1: màu, thanh bên mới, thanh tab điện thoại**
> Bắt đầu pha 1 theo `docs/giao-dien-tu-stitch.md` mục 4 và `docs/stitch/THANH-BEN-MOI.md`: thêm token màu, làm thanh bên sáng 248 px (đủ 10 mục, đúng thứ tự, đúng đường dẫn), thanh trên gọn, thanh tab dưới 5 mục cho điện thoại, thay hoàn toàn thanh bên đỏ cũ trong `Shell.tsx`. Sale không thấy nhóm QUẢN TRỊ. Các trang mới (`/deals`, `/reminders`, `/performance`, `/channels`) tạo khung trống có trạng thái đang tải, rỗng, lỗi. Làm xong chạy `pnpm typecheck`, `pnpm test`, `pnpm build`, xem ở 1440 px và 390 px, rồi báo thật.

**Pha 2: Hội thoại + Câu trả lời nhanh**
> Pha 2: làm lại khung Hội thoại theo ảnh `hoi-thoai-may-tinh.png` (chỉ lấy bố cục vùng nội dung, KHÔNG lấy tab đỏ) và `docs/stitch/CAU-TRA-LOI-NHANH.md` (nút tia sét, bảng chọn máy tính, toàn màn hình điện thoại, con mắt, bottom sheet, thay biến `{tên khách}`). Giữ nguyên chức năng cũ: khoá nhắn, hỏi lại khi trùng, đang soạn, gửi ảnh/PDF. Nghiệm thu theo mục F của file CAU-TRA-LOI-NHANH.

**Pha 3: Thư viện trả lời** — theo `mau-nhanh.png` + mục 3 của `6-man-hinh-con-lai.md`. Chỉ lấy vùng nội dung. Không làm phím tắt, nhãn `#tag`, "Dùng N lần".

**Pha 4: Khách hàng và Quản trị tài khoản** — theo `khach-hang.html`, `quan-tri-tai-khoan.html` (bỏ tab đỏ trong file).

**Pha 5: Đơn đặt tour và Lịch hẹn nhắc** — theo `don-dat-tour.html`, `lich-hen-nhac.html`. Cần thêm API ở backend: trước khi sửa backend, hãy nói tôi biết sẽ thêm gì.

**Pha 6: Thống kê, Hiệu suất sale, Kênh kết nối** — theo `thong-ke.html`, `hieu-suat-sale.html`, `kenh-ket-noi.html`, và Phần B của `giao-dien-cai-dat-va-bieu-do.md` (biểu đồ cột, chấm, tròn). Không hiện khoá `INGEST_API_KEY`.

**Pha 7: Cài đặt hiển thị (sáng/tối/chủ đề)** — theo `cai-dat-hien-thi.png` và Phần A của `giao-dien-cai-dat-va-bieu-do.md`.

## Sau mỗi pha: bạn kiểm tra (5 phút)
- Mở trang ở máy tính và thu hẹp cửa sổ cỡ điện thoại (hoặc mở bằng điện thoại): có tràn ngang không, chữ có xuống dòng lệch không.
- So với ảnh `.png` tương ứng: bố cục có giống không (màu, vị trí nút).
- Đăng nhập bằng tài khoản sale: **không** được thấy Thống kê, Hiệu suất, Kênh kết nối, Quản trị.
- Chức năng cũ vẫn chạy: nhắn tin, gửi ảnh.
- Hỏi nó: "Phần nào bạn chưa kiểm tra được?" rồi bắt nó nói thật.
- Hài lòng thì `git add` + `git commit` ở nhánh `giao-dien-moi` (hoặc nhờ tôi), rồi mới sang pha sau.

## Khi nó làm sai hoặc làm tắt
- Nói thẳng: "Quay lại `docs/stitch/THANH-BEN-MOI.md` mục QUY TẮC BẮT BUỘC, bạn đang dùng tab đỏ cũ" (hoặc dẫn đúng mục nó bỏ qua).
- Nếu nó tự thêm tính năng ngoài file: "Chỉ làm đúng tài liệu. Việc thêm hãy hỏi tôi."
- Nếu nó định đổi database hay chạy lệnh nguy hiểm: dừng, nhắn tôi.
- Quá dài, nó quên: mở cuộc trò chuyện mới và dán lại **Tin nhắn đầu tiên** rồi nói "tiếp tục pha N".

## Những gì tài liệu **cố ý chưa** giao
Thông báo/phím tắt/phiên đăng nhập trong Cài đặt, phím tắt `/mã` và nhãn mẫu, đồng bộ Lịch Google, kết nối Zalo OA/Facebook thật, hạng VIP. Nếu ChatGPT hỏi, trả lời "để sau".
