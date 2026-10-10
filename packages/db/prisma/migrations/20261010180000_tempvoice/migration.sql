-- CreateTable
CREATE TABLE "TempVoiceConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lobbyChannelId" VARCHAR(20),
    "categoryId" VARCHAR(20),
    "nameTemplate" VARCHAR(100) NOT NULL DEFAULT '{user}''s room',
    "defaultUserLimit" INTEGER NOT NULL DEFAULT 0,
    "allowVideoByDefault" BOOLEAN NOT NULL DEFAULT true,
    "allowSoundboardByDefault" BOOLEAN NOT NULL DEFAULT true,
    "blockedWords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempVoiceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TempVoiceChannel" (
    "id" TEXT NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "ownerId" VARCHAR(20) NOT NULL,
    "panelMessageId" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempVoiceChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TempVoiceChannel_channelId_key" ON "TempVoiceChannel"("channelId");

-- CreateIndex
CREATE INDEX "TempVoiceChannel_ownerId_idx" ON "TempVoiceChannel"("ownerId");


-- Hand-written (Prisma can't express these) -------------------------------

-- TempVoiceConfig is a singleton, and its values stay sane whatever writes them.
ALTER TABLE "TempVoiceConfig" ADD CONSTRAINT "TempVoiceConfig_singleton_check" CHECK ("id" = 1);
ALTER TABLE "TempVoiceConfig" ADD CONSTRAINT "TempVoiceConfig_lobbyChannelId_check"
  CHECK ("lobbyChannelId" IS NULL OR "lobbyChannelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "TempVoiceConfig" ADD CONSTRAINT "TempVoiceConfig_categoryId_check"
  CHECK ("categoryId" IS NULL OR "categoryId" ~ '^[0-9]{17,20}$');
-- Discord allows 0 (no limit) to 99 members in a voice channel.
ALTER TABLE "TempVoiceConfig" ADD CONSTRAINT "TempVoiceConfig_defaultUserLimit_check"
  CHECK ("defaultUserLimit" BETWEEN 0 AND 99);
ALTER TABLE "TempVoiceConfig" ADD CONSTRAINT "TempVoiceConfig_nameTemplate_check"
  CHECK (length(btrim("nameTemplate")) > 0);
-- A room can't be switched on without a lobby to join.
ALTER TABLE "TempVoiceConfig" ADD CONSTRAINT "TempVoiceConfig_enabled_needs_lobby_check"
  CHECK (NOT "enabled" OR "lobbyChannelId" IS NOT NULL);

ALTER TABLE "TempVoiceChannel" ADD CONSTRAINT "TempVoiceChannel_channelId_check" CHECK ("channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "TempVoiceChannel" ADD CONSTRAINT "TempVoiceChannel_ownerId_check" CHECK ("ownerId" ~ '^[0-9]{17,20}$');
ALTER TABLE "TempVoiceChannel" ADD CONSTRAINT "TempVoiceChannel_panelMessageId_check"
  CHECK ("panelMessageId" IS NULL OR "panelMessageId" ~ '^[0-9]{17,20}$');

-- The one config row (disabled until an admin sets a lobby and turns it on).
INSERT INTO "TempVoiceConfig" ("id", "blockedWords", "updatedAt") VALUES (1, ARRAY[]::TEXT[], CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
