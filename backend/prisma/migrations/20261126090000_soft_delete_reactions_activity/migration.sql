-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "changedAt" TIMESTAMP(3),
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "isAvailable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "message_reactions" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL,
    "staffId" TEXT,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_reactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "actorRole" "Role",
    "group" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "conversationId" TEXT,
    "targetId" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_reactions_messageId_actorKey_key" ON "message_reactions"("messageId", "actorKey");

-- CreateIndex
CREATE INDEX "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_actorId_createdAt_idx" ON "activity_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "conversations_isAvailable_deletedAt_idx" ON "conversations"("isAvailable", "deletedAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_changedAt_idx" ON "messages"("conversationId", "changedAt");

-- CreateIndex
CREATE INDEX "messages_isAvailable_deletedAt_idx" ON "messages"("isAvailable", "deletedAt");

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_reactions" ADD CONSTRAINT "message_reactions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Khách nhắn tin mới vào hội thoại đã xoá mềm thì hội thoại hiện lại (tin cũ đã xoá vẫn ẩn, nằm ở tab Khôi phục).
-- Đặt ở trigger để cả đường chatbot ghi thẳng database (D:\ChatBot\lich_su_db.py) cũng đúng.
CREATE OR REPLACE FUNCTION btt_messages_revive_conversation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET "isAvailable" = true, "deletedAt" = NULL, "deletedById" = NULL
  WHERE id = NEW."conversationId" AND "isAvailable" = false;
  RETURN NULL;
END
$$;

CREATE TRIGGER messages_revive_conversation
AFTER INSERT ON messages
FOR EACH ROW WHEN (NEW."senderType" = 'CUSTOMER' AND NEW."isAvailable" = true)
EXECUTE FUNCTION btt_messages_revive_conversation();
