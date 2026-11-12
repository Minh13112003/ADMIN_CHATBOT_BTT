# Backend

- `AuthGuard` đăng ký toàn cục: route mới mặc định cần đăng nhập và vai trò `SALE` hoặc `ADMIN`. Mở công khai dùng `@Public`, cho admin dùng `@Roles(Role.ADMIN)`.
- Đăng nhập bằng cookie `btt_admin_token` (`httpOnly`). Phiên trượt (đổi ngày 2026-11-11, trước là 12 giờ cố định làm sang ngày bị đăng xuất): `AuthGuard` cấp lại cookie khi token đã quá 1 giờ; không dùng `SESSION_DAYS` (7) ngày thì hết, tối đa `SESSION_MAX_DAYS` (30) ngày từ lần nhập mật khẩu. Quy tắc ở `common/session.ts`. Không trả token trong JSON. Frontend và backend chạy khác tên miền con thì đặt `COOKIE_DOMAIN`; khác hẳn tên miền thì cookie không dùng được.
- `ValidationPipe` bật `forbidNonWhitelisted`: mọi field nhận vào phải khai báo trong DTO, thông báo lỗi bằng tiếng Việt.
- **Logic quyết định đặt trong hàm thuần ở `common/` và có test `.spec.ts`**; service chỉ đọc ghi database rồi gọi hàm đó.
- Giờ tin nhắn: khi tạo nhiều tin trong một lần, đặt `createdAt` tường minh để giữ thứ tự (bug thật: log đứng trước câu của khách).
- Sau khi đổi dữ liệu hội thoại, phát sự kiện qua `RealtimeGateway.emit`: `conversation:update`, `message:new`, `contact:new` (kèm `kind: 'BOOKING'` khi khách tự đặt tour), `support:new` (đồng nghiệp hỗ trợ / chuyển khách, gửi kèm `toUserId`), `followup:due`.
- "Đang soạn" giữ trong Redis 15 giây khi có `REDIS_URL`, nếu không thì giữ trong bộ nhớ của `RealtimeGateway` (`dangGo`). Không ghi database: gõ phím không được xoá dấu "vừa gửi" của người khác. Redis adapter phát socket tới mọi máy chủ.
- Hẹn nhắc: `ConversationsService.nhacHen` chạy mỗi phút.
- Chia việc phải nằm trong transaction, dùng `pg_advisory_xact_lock` để 2 khách cùng lúc không chia lệch. Khoá này hoạt động qua pooler Supabase ở chế độ transaction.
- Tìm khách (hộp thư và trang Khách hàng) qua `timKhach` → `customers.searchText` chứa từng từ khoá của `khoaTimKiem`. Không tìm thẳng trên `name`/`phone`: không bỏ dấu được và không dùng được chỉ mục.
- Thống kê không quét bảng `messages` (sẽ hàng triệu dòng); cần số theo tin nhắn thì thêm cột tổng hợp như `lastCustomerMessageAt`.
- File đính kèm: lưu trên ổ đĩa (`STORAGE_DIR`, dùng khi chạy trên VPS, `deploy/`) hoặc Supabase Storage bucket riêng tư, qua `storage/` (`StorageService` gọi REST, `AttachmentsService` kiểm tra theo **nội dung** file rồi thu nhỏ ảnh bằng `sharp`). Hàm thuần ở `common/attachments.ts`. Bảng `messages` chỉ giữ đường dẫn; API trả `attachment` với link ký HMAC có hạn (`GET /files/:id`), không bao giờ trả `attachmentPath`. Khoá `SUPABASE_SECRET_KEY` chỉ ở backend. Gửi file là multipart (`POST /conversations/:id/messages/file`, `POST /ingest/inbound-file`).
- Số tiền kiểu `BigInt`, `main.ts` đã chuyển sang số khi trả JSON.
- Múi giờ thống kê và giờ làm việc tính theo giờ Việt Nam (UTC+7), xem `dauKy`, `ngoaiGioLamViec`.
- Prisma 7: địa chỉ database không còn trong `schema.prisma`. Chỉ còn một địa chỉ `DATABASE_URL` (Session pooler, cổng 5432), cả migrate (`backend/prisma.config.ts`) lẫn ứng dụng đều đọc nó, ứng dụng qua driver `pg` (`src/prisma/connection.ts`, tự bỏ `pgbouncer` và `connection_limit`). Client sinh ra ở `src/generated/prisma` (không commit), import từ `generated/prisma/client`, không import từ `@prisma/client`.
- Prisma trên Windows: tắt server đang chạy trước khi `prisma generate`, nếu không sẽ lỗi `EPERM`.
- Supabase: `DATABASE_URL` là Session pooler cổng 5432 (Transaction pooler 6543 không chạy được migrate). Database phải là UTF-8.
- Thông tin kết nối Zalo/Facebook (đổi ngày 2026-11-12): admin nhập ở trang Kênh kết nối, lưu bảng `channel_secrets`, mã hoá AES-256-GCM bằng `ENCRYPTION_KEY` trong .env (`common/secret-box.ts`). API `/channel-settings/:channel` chỉ ADMIN, không bao giờ trả giá trị bí mật (chỉ đuôi 4 ký tự). Đổi `ENCRYPTION_KEY` thì giá trị cũ không đọc được, phải nhập lại. Webhook nhận tin Zalo/Facebook chưa làm.
