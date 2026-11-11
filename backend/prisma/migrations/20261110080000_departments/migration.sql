ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DEPT_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DIGITAL';

CREATE TABLE "departments" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

ALTER TABLE "users" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "users" ADD COLUMN "scopeIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "users_departmentId_idx" ON "users"("departmentId");
CREATE INDEX "messages_tours_idx" ON "messages"("createdAt") WHERE "tours" IS NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
