-- CreateTable
CREATE TABLE "place_interests" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "place_interests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "place_interests_createdAt_idx" ON "place_interests"("createdAt");

-- CreateIndex
CREATE INDEX "place_interests_conversationId_idx" ON "place_interests"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "place_interests_customerId_place_day_key" ON "place_interests"("customerId", "place", "day");

-- AddForeignKey
ALTER TABLE "place_interests" ADD CONSTRAINT "place_interests_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "place_interests" ADD CONSTRAINT "place_interests_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
