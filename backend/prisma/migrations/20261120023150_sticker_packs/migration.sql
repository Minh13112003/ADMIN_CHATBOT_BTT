-- AlterTable
ALTER TABLE "stickers" ADD COLUMN     "packId" TEXT;

-- CreateTable
CREATE TABLE "sticker_packs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sticker_packs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sticker_packs_name_key" ON "sticker_packs"("name");

-- CreateIndex
CREATE INDEX "stickers_packId_idx" ON "stickers"("packId");

-- AddForeignKey
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_packId_fkey" FOREIGN KEY ("packId") REFERENCES "sticker_packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
