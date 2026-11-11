-- CreateEnum
CREATE TYPE "VoucherType" AS ENUM ('AMOUNT', 'PERCENT');

-- CreateEnum
CREATE TYPE "VoucherScope" AS ENUM ('TOUR', 'CATEGORY', 'ALL');

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "departureDate" DATE,
ADD COLUMN     "discount" BIGINT,
ADD COLUMN     "subtotal" BIGINT,
ADD COLUMN     "tourKey" TEXT,
ADD COLUMN     "unitPrice" BIGINT,
ADD COLUMN     "voucherCode" TEXT,
ADD COLUMN     "voucherId" TEXT;

-- CreateTable
CREATE TABLE "tour_interest_tags" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "tourKey" TEXT NOT NULL,
    "tourName" TEXT NOT NULL,
    "categoryId" INTEGER,
    "categoryName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_interest_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "VoucherType" NOT NULL,
    "value" INTEGER NOT NULL,
    "maxDiscount" BIGINT,
    "scope" "VoucherScope" NOT NULL,
    "tourKey" TEXT,
    "tourName" TEXT,
    "categoryId" INTEGER,
    "categoryName" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "departmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tour_interest_tags_conversationId_createdAt_idx" ON "tour_interest_tags"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "tour_interest_tags_tourKey_createdAt_idx" ON "tour_interest_tags"("tourKey", "createdAt");

-- CreateIndex
CREATE INDEX "tour_interest_tags_createdAt_idx" ON "tour_interest_tags"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_departmentId_idx" ON "vouchers"("departmentId");

-- CreateIndex
CREATE INDEX "deals_voucherId_idx" ON "deals"("voucherId");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "vouchers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_interest_tags" ADD CONSTRAINT "tour_interest_tags_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_interest_tags" ADD CONSTRAINT "tour_interest_tags_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_interest_tags" ADD CONSTRAINT "tour_interest_tags_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

