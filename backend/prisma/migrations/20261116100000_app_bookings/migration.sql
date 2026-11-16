-- AlterEnum
ALTER TYPE "DealSource" ADD VALUE 'APP';

-- AlterTable
ALTER TABLE "deals" ADD COLUMN     "adults" INTEGER,
ADD COLUMN     "children" INTEGER,
ADD COLUMN     "departureKey" TEXT,
ADD COLUMN     "infants" INTEGER,
ADD COLUMN     "notice" TEXT,
ADD COLUMN     "pointsAwarded" INTEGER,
ADD COLUMN     "returnDate" DATE,
ADD COLUMN     "tourImage" TEXT;

-- AlterTable
ALTER TABLE "app_accounts" ADD COLUMN     "earnedPoints" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "deal_guests" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "nationalId" TEXT,
    "passportNumber" TEXT,
    "phone" TEXT,

    CONSTRAINT "deal_guests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_guests_dealId_idx" ON "deal_guests"("dealId");

-- AddForeignKey
ALTER TABLE "deal_guests" ADD CONSTRAINT "deal_guests_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

