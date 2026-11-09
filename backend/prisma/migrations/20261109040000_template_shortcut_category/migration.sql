-- AlterTable
ALTER TABLE "quick_templates" ADD COLUMN     "category" TEXT,
ADD COLUMN     "shortcut" TEXT,
ADD COLUMN     "useCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "quick_templates_shortcut_key" ON "quick_templates"("shortcut");
