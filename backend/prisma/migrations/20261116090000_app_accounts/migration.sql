-- CreateTable
CREATE TABLE "app_accounts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "refreshTokenHash" TEXT,
    "pinHash" TEXT,
    "fcmToken" TEXT,
    "email" TEXT,
    "dateOfBirth" DATE,
    "gender" TEXT,
    "nationalId" TEXT,
    "passportNumber" TEXT,
    "passportExpiry" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_accounts_customerId_key" ON "app_accounts"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "app_accounts_phone_key" ON "app_accounts"("phone");

-- AddForeignKey
ALTER TABLE "app_accounts" ADD CONSTRAINT "app_accounts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_accounts" ADD CONSTRAINT "app_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

