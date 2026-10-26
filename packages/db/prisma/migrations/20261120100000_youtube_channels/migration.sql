-- AlterTable
ALTER TABLE "YoutubeConfig" ADD COLUMN "envAdopted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "YoutubeChannel" (
    "id" TEXT NOT NULL,
    "ytChannelId" VARCHAR(24) NOT NULL,
    "name" VARCHAR(100) NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "seededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeChannel_ytChannelId_key" ON "YoutubeChannel"("ytChannelId");

ALTER TABLE "YoutubeChannel" ADD CONSTRAINT "YoutubeChannel_ytChannelId_valid" CHECK ("ytChannelId" ~ '^UC[A-Za-z0-9_-]{22}$');
