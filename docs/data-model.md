# Dữ liệu

Nguồn chuẩn: `backend/prisma/schema.prisma`.

| Bảng | Vai trò |
|---|---|
| `users` | Tài khoản `ADMIN`, `SALE`; mã nhân viên, vị trí, đang trực |
| `customers` | Khách, SĐT duy nhất, các cách viết tên trong `aliases` |
| `customer_identities` | Mã khách theo từng kênh: `(channel, externalId)` trỏ về một khách |
| `conversations` | Mỗi khách một hội thoại liên tục trên mỗi kênh: trạng thái, chế độ bot/nhân viên, người phụ trách, hoạt động gần nhất, hẹn nhắc (`followUpAt`), lần cuối khách xem tin (`customerSeenAt`). `helperId` không dùng nữa |
| `messages` | Tin nhắn lưu vĩnh viễn. `senderType`: khách, bot, tự động, nhân viên, hệ thống. `internal = true` là log không gửi cho khách. Tin có file: `attachmentPath` (đường dẫn trong bucket Supabase Storage, không phải link), `attachmentType`, `attachmentName`, `attachmentSize`; `text` có thể rỗng |
| `quick_templates` | Mẫu trả lời nhanh |
| `auto_reply_rules` | Quy tắc tự động: tin đầu, từ khoá, ngoài giờ |
| `deals` | Đơn đặt tour. `status`: chờ xác nhận / đã chốt / huỷ, chỉ `CONFIRMED` không `voidedAt` tính doanh thu. `source`: khách tự đặt qua chatbot hay sale nhập. `tourCode` mã đợt khởi hành, `orderCode` id booking BE Mobile, `bookingStatus` trạng thái BE Mobile báo về; `bookingUpdatedAt` là mốc `occurredAt` mới nhất đã áp dụng để bỏ cập nhật cũ |
| `contact_responses` | Mỗi lần khách đòi gặp nhân viên được trả lời: bao nhiêu giây, ai trả lời. Nguồn số "thời gian phản hồi" |
| `ai_usage` | Token Gemini từng lần gọi, nguồn chi phí |

Quan hệ chính: một khách có nhiều mã kênh và nhiều hội thoại (mỗi kênh một), một hội thoại có nhiều tin và nhiều đơn.

## Cột do database tự điền

Hai cột dưới đây do trigger trong database tính (migration `search_and_stats_indexes`), nên đúng cả khi chatbot ghi thẳng bằng `lich_su_db.py`. Không ghi tay vào chúng.

| Cột | Trigger | Dùng cho |
|---|---|---|
| `customers.searchText` | `customers_search_text`, chạy khi đổi `name`, `aliases`, `phone` | Ô tìm kiếm: tên, tên khác, SĐT viết thường, bỏ dấu. Hàm SQL `btt_bo_dau` phải khớp `khoaTimKiem` trong `common/text.ts` |
| `conversations.lastCustomerMessageAt` | `messages_last_customer`, chạy khi thêm tin `CUSTOMER` | Thống kê "khách nhắn tin trong kỳ" mà không quét bảng tin nhắn |

## Chỉ mục và dung lượng

Đo trên database thử 1 triệu tin, 20.000 khách (ngày 2026-11-06):

- 1 triệu tin chiếm khoảng 408 MB, cả database khoảng 510 MB. Gói Free của Supabase giới hạn 500 MB, nên tới cỡ này cần gói Pro hoặc chuyển tin cũ sang kho lưu trữ.
- Mở hội thoại (100 tin mới nhất) dùng `messages(conversationId, createdAt)`: khoảng 0,1 ms, không chậm đi khi bảng lớn.
- Hộp thư dùng `conversations(lastMessageAt)`, tìm khách dùng chỉ mục trigram GIN trên `customers.searchText` (extension `pg_trgm`).
- Tìm trong nội dung tin: chỉ mục toàn văn `messages_text_fts_idx` trên `btt_bo_dau(text)` (migration `sale_workflow`). Prisma không mô tả được chỉ mục biểu thức nên nó không có trong `schema.prisma`, migrate cũng không xoá nó.
- `ai_usage.createdAt` dùng BRIN vì bảng chỉ ghi nối đuôi: 24 kB thay cho 8,8 MB của B-tree.
- Chỉ mục lớn nhất là khoá chính `messages.id` (73 MB / 1 triệu tin) vì id lưu dạng chữ. Đổi sang kiểu `uuid` sẽ giảm khoảng một nửa nhưng phải đổi cả khoá ngoại và SQL của chatbot, chưa làm.
