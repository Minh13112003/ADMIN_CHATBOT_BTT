-- CreateTable
CREATE TABLE "channel_secrets" (
    "channel" "Channel" NOT NULL,
    "name" TEXT NOT NULL,
    "valueEnc" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_secrets_pkey" PRIMARY KEY ("channel","name")
);
