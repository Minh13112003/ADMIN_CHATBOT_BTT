-- AlterTable
ALTER TABLE "vouchers" ADD COLUMN     "maxUsesPerCustomerMonth" INTEGER,
ADD COLUMN     "tier" TEXT;

-- AlterTable
ALTER TABLE "app_accounts" ADD COLUMN     "avatarPath" TEXT;

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_favorites" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tourKey" TEXT NOT NULL,
    "tourName" TEXT NOT NULL,
    "tourImage" TEXT,
    "durationText" TEXT,
    "unitPrice" BIGINT,
    "departureDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_feedbacks" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_notifications_accountId_createdAt_idx" ON "app_notifications"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_favorites_accountId_tourKey_key" ON "app_favorites"("accountId", "tourKey");

-- CreateIndex
CREATE INDEX "app_feedbacks_createdAt_idx" ON "app_feedbacks"("createdAt");

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_favorites" ADD CONSTRAINT "app_favorites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_feedbacks" ADD CONSTRAINT "app_feedbacks_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "app_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

