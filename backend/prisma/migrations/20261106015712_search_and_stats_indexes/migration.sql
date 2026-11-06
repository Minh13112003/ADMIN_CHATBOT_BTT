-- Phần viết tay (Prisma không sinh được extension, hàm, trigger). Xem docs/data-model.md, mục "Cột do database tự điền".

-- Chỉ mục trigram cho tìm "chứa chuỗi". Supabase có sẵn extension này, chỉ cần bật.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Viết thường, bỏ dấu tiếng Việt, gộp khoảng trắng. Phải khớp hàm khoaTimKiem trong backend/src/common/text.ts.
-- Tách dấu (NFD) trước rồi mới lower: database locale C chỉ đổi chữ hoa ASCII, sau NFD mọi chữ Việt đều là ASCII + dấu, trừ đ/Đ.
CREATE OR REPLACE FUNCTION btt_bo_dau(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT btrim(regexp_replace(lower(regexp_replace(translate(normalize(coalesce(t, ''), NFD), 'đĐ', 'dd'), '[\u0300-\u036f]', '', 'g')), '\s+', ' ', 'g'))
$$;

-- DropIndex
DROP INDEX "ai_usage_createdAt_idx";

-- DropIndex
DROP INDEX "customers_name_idx";

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "lastCustomerMessageAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "ai_usage_createdAt_idx" ON "ai_usage" USING BRIN ("createdAt");

-- CreateIndex
CREATE INDEX "conversations_lastMessageAt_idx" ON "conversations"("lastMessageAt");

-- CreateIndex
CREATE INDEX "conversations_lastCustomerMessageAt_idx" ON "conversations"("lastCustomerMessageAt");

-- CreateIndex
CREATE INDEX "customers_searchText_idx" ON "customers" USING GIN ("searchText" gin_trgm_ops);

-- customers."searchText": tự tính lại khi đổi tên, tên khác hoặc SĐT, kể cả khi chatbot ghi thẳng vào database.
CREATE OR REPLACE FUNCTION btt_customers_search_text() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."searchText" := btt_bo_dau(concat_ws(' ', NEW.name, array_to_string(NEW.aliases, ' '), NEW.phone));
  RETURN NEW;
END
$$;

CREATE TRIGGER customers_search_text
BEFORE INSERT OR UPDATE OF name, aliases, phone ON customers
FOR EACH ROW EXECUTE FUNCTION btt_customers_search_text();

UPDATE customers SET "searchText" = btt_bo_dau(concat_ws(' ', name, array_to_string(aliases, ' '), phone));

-- conversations."lastCustomerMessageAt": cập nhật mỗi khi có tin của khách, từ backend hay chatbot đều vậy.
CREATE OR REPLACE FUNCTION btt_messages_last_customer() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET "lastCustomerMessageAt" = NEW."createdAt"
  WHERE id = NEW."conversationId" AND ("lastCustomerMessageAt" IS NULL OR "lastCustomerMessageAt" < NEW."createdAt");
  RETURN NULL;
END
$$;

CREATE TRIGGER messages_last_customer
AFTER INSERT ON messages
FOR EACH ROW WHEN (NEW."senderType" = 'CUSTOMER')
EXECUTE FUNCTION btt_messages_last_customer();

UPDATE conversations c SET "lastCustomerMessageAt" = m.t
FROM (SELECT "conversationId", max("createdAt") AS t FROM messages WHERE "senderType" = 'CUSTOMER' GROUP BY 1) m
WHERE m."conversationId" = c.id;
