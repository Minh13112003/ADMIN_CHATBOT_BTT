-- Chỉ thêm dữ liệu, không đổi cấu trúc bảng: mẫu trả lời nhanh xin số điện thoại (chủ dự án yêu cầu 2026-11-13, thay nút gửi thẻ Zalo).
-- Đã có mẫu cùng phím tắt "sdt" thì bỏ qua.
INSERT INTO "quick_templates" ("id", "title", "body", "shortcut", "category")
SELECT gen_random_uuid()::text,
       'Xin số điện thoại',
       'Dạ anh/chị cho em xin họ tên và số điện thoại để tư vấn viên liên hệ tư vấn và giữ chỗ tour nhanh hơn ạ.',
       'sdt',
       'Thông tin khách'
WHERE NOT EXISTS (SELECT 1 FROM "quick_templates" WHERE "shortcut" = 'sdt');
