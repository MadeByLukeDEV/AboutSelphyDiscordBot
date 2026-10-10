-- CreateTable
CREATE TABLE "YoutubeConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "pingRoleId" VARCHAR(20),
    "messageTemplate" VARCHAR(300) NOT NULL DEFAULT 'New video: {title}',
    "announceShorts" BOOLEAN NOT NULL DEFAULT false,
    "embedColor" INTEGER NOT NULL DEFAULT 16711680,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" VARCHAR(40) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeVideo" (
    "id" TEXT NOT NULL,
    "videoId" VARCHAR(20) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "isShort" BOOLEAN NOT NULL DEFAULT false,
    "messageId" VARCHAR(20),
    "announcedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideo_videoId_key" ON "YoutubeVideo"("videoId");

-- CreateIndex
CREATE INDEX "YoutubeVideo_publishedAt_idx" ON "YoutubeVideo"("publishedAt");


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "YoutubeConfig" ADD CONSTRAINT "YoutubeConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "YoutubeConfig" ADD CONSTRAINT "YoutubeConfig_ids_digits"
  CHECK (("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$') AND ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "YoutubeConfig" ADD CONSTRAINT "YoutubeConfig_embedColor_range" CHECK ("embedColor" BETWEEN 0 AND 16777215);
-- Switching it on needs somewhere to post.
ALTER TABLE "YoutubeConfig" ADD CONSTRAINT "YoutubeConfig_enabled_has_channel" CHECK (NOT "enabled" OR "channelId" IS NOT NULL);
ALTER TABLE "YoutubeVideo" ADD CONSTRAINT "YoutubeVideo_ids"
  CHECK ("videoId" ~ '^[A-Za-z0-9_-]{6,20}$' AND ("messageId" IS NULL OR "messageId" ~ '^[0-9]{17,20}$'));
