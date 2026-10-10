-- CreateTable
CREATE TABLE "StarboardConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "emoji" VARCHAR(16) NOT NULL DEFAULT '⭐',
    "threshold" INTEGER NOT NULL DEFAULT 3,
    "allowSelf" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StarboardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarboardPost" (
    "sourceMessageId" VARCHAR(20) NOT NULL,
    "sourceChannelId" VARCHAR(20) NOT NULL,
    "authorId" VARCHAR(20) NOT NULL,
    "authorName" VARCHAR(100) NOT NULL,
    "excerpt" VARCHAR(200) NOT NULL,
    "jumpUrl" VARCHAR(200) NOT NULL,
    "boardMessageId" VARCHAR(20),
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StarboardPost_pkey" PRIMARY KEY ("sourceMessageId")
);

-- CreateIndex
CREATE INDEX "StarboardPost_stars_idx" ON "StarboardPost"("stars");

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "StarboardConfig" ADD CONSTRAINT "StarboardConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "StarboardConfig" ADD CONSTRAINT "StarboardConfig_channel_digits" CHECK ("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "StarboardConfig" ADD CONSTRAINT "StarboardConfig_threshold_range" CHECK ("threshold" BETWEEN 1 AND 25);
ALTER TABLE "StarboardConfig" ADD CONSTRAINT "StarboardConfig_emoji_not_empty" CHECK (length("emoji") > 0);
ALTER TABLE "StarboardConfig" ADD CONSTRAINT "StarboardConfig_enabled_has_channel" CHECK (NOT "enabled" OR "channelId" IS NOT NULL);
ALTER TABLE "StarboardPost" ADD CONSTRAINT "StarboardPost_ids_digits"
  CHECK ("sourceMessageId" ~ '^[0-9]{17,20}$' AND "sourceChannelId" ~ '^[0-9]{17,20}$' AND "authorId" ~ '^[0-9]{17,20}$'
     AND ("boardMessageId" IS NULL OR "boardMessageId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "StarboardPost" ADD CONSTRAINT "StarboardPost_stars_positive" CHECK ("stars" >= 0);
ALTER TABLE "StarboardPost" ADD CONSTRAINT "StarboardPost_jump_url" CHECK ("jumpUrl" ~ '^https://discord\.com/channels/[0-9]+/[0-9]+/[0-9]+$');
