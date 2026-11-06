# Frontend

- Trang không cần SEO nên dùng React + Vite, không có phần chạy phía máy chủ. Đường dẫn khai báo ở `src/App.tsx` bằng React Router. Biến môi trường phải có tiền tố `VITE_`, đọc qua `import.meta.env`, và đi vào file build nên không đặt bí mật ở đây.
- `RequireAuth` hỏi `/auth/me` rồi chuyển về `/login` khi 401, vì cookie `httpOnly` nên JavaScript không đọc được. Chỉ để dễ dùng, quyền thật do backend kiểm tra.
- Triển khai: `dist/` là file tĩnh, máy chủ phải trả `index.html` cho mọi đường dẫn không phải file (SPA fallback), nếu không tải lại `/inbox` sẽ ra 404.
- Gọi API qua `lib/api.ts` (`api`, `post`, `patch`, `del`, `fetcher`), luôn gửi cookie. Đọc dữ liệu bằng SWR với key là đường dẫn API.
- Thời gian thực ở `lib/realtime.tsx`: sự kiện socket gọi `mutate` lại các key SWR, không tự ghép dữ liệu ở client. Thêm key mới cần làm mới thì sửa `lamMoi`.
- Màu và kích thước theo token trong `src/globals.css` (`brand`, `ink`, `muted`, `line`, `auto`...), nhãn trạng thái và kênh ở `lib/labels.ts`. Đỏ thương hiệu `#D0021B`, đậm `#B30118`.
- Font **Be Vietnam Pro**, tự host qua gói `@fontsource/be-vietnam-pro` (nạp ở `main.tsx`). Không dùng Rubik: Google Fonts không có bộ chữ tiếng Việt cho Rubik, dấu bị lẫn font.
- Thành phần chung ở `components/ui.tsx`: `Switch`, `Segmented`, `Dialog`, `Field`, `DeleteButton`, `ErrorText`. Không dùng `alert` hay `confirm` của trình duyệt.
- Giao diện ưu tiên khung chat: cột thông tin khách **đóng sẵn**, mở bằng icon 3 gạch. SĐT nằm **dưới** tên khách, không nằm ngang.
- Chạm tối thiểu 44px cho nút chính. Nút chỉ có icon phải có `aria-label`. Trang phải dùng được ở 390px, không tràn ngang.
- Mọi danh sách có trạng thái đang tải, rỗng và lỗi. Chữ giao diện viết tiếng Việt có dấu, không dùng emoji.
