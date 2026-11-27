-- Chủ dự án yêu cầu 2026-11-27: tin OA mà API Zalo không trả nội dung (thẻ chào mừng khi khách quan tâm OA)
-- hiện thành câu chào thay cho dòng "[OA gửi tệp, tin thoại...]". Chỉ đổi tin của OA, tin của khách giữ nguyên.
UPDATE messages
SET text = 'Chào mừng bạn đến với Official Account BenThanh Tourist trên Zalo'
WHERE text = '[OA gửi tệp, tin thoại hoặc nội dung Zalo không cho xem qua API, xem trên Zalo OA]'
  AND "senderType" <> 'CUSTOMER';

UPDATE conversations
SET "lastMessagePreview" = 'Chào mừng bạn đến với Official Account BenThanh Tourist trên Zalo'
WHERE "lastMessagePreview" = '[OA gửi tệp, tin thoại hoặc nội dung Zalo không cho xem qua API, xem trên Zalo OA]';
