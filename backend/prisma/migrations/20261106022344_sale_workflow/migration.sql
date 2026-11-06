-- CreateEnum
CREATE TYPE "DealStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DealSource" AS ENUM ('CHATBOT', 'STAFF');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "customerSeenAt" TIMESTAMP(3),
ADD COLUMN     "followUpAt" TIMESTAMP(3),
ADD COLUMN     "followUpById" TEXT,
ADD COLUMN     "followUpNote" TEXT,
ADD COLUMN     "followUpNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "bookingStatus" TEXT,
ADD COLUMN     "bookingUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "source" "DealSource" NOT NULL DEFAULT 'CHATBOT',
ADD COLUMN     "status" "DealStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "tourCode" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "replyToId" TEXT;

-- CreateTable
CREATE TABLE "contact_responses" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "staffId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seconds" INTEGER NOT NULL,

    CONSTRAINT "contact_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_responses_respondedAt_idx" ON "contact_responses"("respondedAt");

-- CreateIndex
CREATE INDEX "contact_responses_conversationId_idx" ON "contact_responses"("conversationId");

-- CreateIndex
CREATE INDEX "conversations_followUpAt_idx" ON "conversations"("followUpAt");

-- CreateIndex
CREATE INDEX "conversations_tags_idx" ON "conversations" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "deals_conversationId_idx" ON "deals"("conversationId");

-- CreateIndex
CREATE INDEX "deals_customerId_idx" ON "deals"("customerId");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_followUpById_fkey" FOREIGN KEY ("followUpById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_responses" ADD CONSTRAINT "contact_responses_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_responses" ADD CONSTRAINT "contact_responses_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Phần viết tay. Xem docs/data-model.md.

-- Đơn có trước bản này đều đã được tính doanh thu: giữ nguyên là đã chốt. closedById null nghĩa là khách tự đặt qua chatbot.
UPDATE "deals" SET "status" = 'CONFIRMED',
  "source" = CASE WHEN "closedById" IS NULL THEN 'CHATBOT'::"DealSource" ELSE 'STAFF'::"DealSource" END,
  "createdAt" = "closedAt";

-- Tìm trong nội dung tin nhắn: chỉ mục toàn văn trên chữ đã bỏ dấu (btt_bo_dau ở migration search_and_stats_indexes).
-- Prisma không mô tả được chỉ mục biểu thức nên không có trong schema.prisma, và migrate cũng không đụng tới nó.
-- Truy vấn phải viết đúng biểu thức này thì mới dùng được chỉ mục: xem ConversationsService.timTin.
CREATE INDEX "messages_text_fts_idx" ON "messages" USING GIN (to_tsvector('simple'::regconfig, btt_bo_dau("text")));
