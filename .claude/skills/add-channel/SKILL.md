---
name: add-channel
description: Nối một kênh nhắn tin mới vào trang quản trị (Zalo OA, Facebook Messenger, hoặc nối chatbot bttAI). Dùng khi người dùng yêu cầu tích hợp kênh.
---

# Nối một kênh mới

Đọc `.claude/rules/integrations.md` và `docs/ingest-api.md` trước. Xác minh lại giá và API trên tài liệu chính thức vì thông tin có thể đã đổi; nói rõ phần nào chưa xác minh được.

1. **Tài khoản và quyền:** liệt kê thứ người dùng cần cung cấp (App ID, khoá, token). Không xin bí mật qua chat: để họ tự điền vào `backend/.env`.
2. **Nhận tin:** thêm module `backend/src/channels/<kênh>/` có webhook, **xác thực chữ ký**, trả lời nhanh rồi xử lý sau. Chuyển tin về `IngestService.inbound` với `channel` và `externalUserId` của kênh, dùng id tin làm `externalMessageId` để chống trùng khi kênh gửi lại.
3. **Gửi tin:** tin của nhân viên hiện chỉ lưu trong database. Thêm bước gửi ra kênh sau khi `ConversationsService.send` lưu xong, báo lỗi rõ cho sale nếu gửi hỏng hoặc đã quá khung thời gian của kênh.
4. **Bot của kênh:** phải tắt hoặc nhường khi `mode = STAFF`, nếu không khách nhận 2 câu trả lời.
5. **Tên và SĐT:** các kênh này thường không có SĐT, dòng khách phải hiện đúng "Chưa có số điện thoại".
6. **Giao diện:** đổi `connected: true` trong `frontend/src/lib/labels.ts`. Thêm ghi chú khung thời gian của kênh ở khung nhắn.
7. **Thử:** kiểm tra bằng tài khoản thật, thêm test cho logic mới, chạy skill `verify`, cập nhật `integrations.md`.
