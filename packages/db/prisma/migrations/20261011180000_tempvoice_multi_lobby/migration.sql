-- Several lobbies instead of one.
--
-- Order matters: the generated script dropped the old columns first. Here the new
-- table is created, the existing lobby is COPIED into it, and only then are the
-- old columns removed. The whole file runs as one implicit transaction, so it
-- either all applies or none of it does.

-- 1. The new table ---------------------------------------------------------------
CREATE TABLE "TempVoiceLobby" (
    "id" TEXT NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "categoryId" VARCHAR(20),
    "nameTemplate" VARCHAR(100) NOT NULL DEFAULT '{user}''s room',
    "defaultUserLimit" INTEGER NOT NULL DEFAULT 0,
    "allowVideoByDefault" BOOLEAN NOT NULL DEFAULT true,
    "allowSoundboardByDefault" BOOLEAN NOT NULL DEFAULT true,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempVoiceLobby_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TempVoiceLobby_channelId_key" ON "TempVoiceLobby"("channelId");

-- 2. The room table remembers which lobby a room came from ------------------------
ALTER TABLE "TempVoiceChannel" ADD COLUMN "lobbyChannelId" VARCHAR(20);

-- 3. Copy the existing single lobby, with all its settings ------------------------
INSERT INTO "TempVoiceLobby"
  ("id", "channelId", "categoryId", "nameTemplate", "defaultUserLimit",
   "allowVideoByDefault", "allowSoundboardByDefault", "enabled", "createdAt", "updatedAt")
SELECT 'migrated_' || "lobbyChannelId", "lobbyChannelId", "categoryId", "nameTemplate", "defaultUserLimit",
       "allowVideoByDefault", "allowSoundboardByDefault", true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "TempVoiceConfig"
 WHERE "lobbyChannelId" IS NOT NULL;

-- Rooms that are open right now came from that lobby.
UPDATE "TempVoiceChannel"
   SET "lobbyChannelId" = (SELECT "lobbyChannelId" FROM "TempVoiceConfig" WHERE "id" = 1)
 WHERE "lobbyChannelId" IS NULL;

-- 4. Remove the old single-lobby columns and the checks that depended on them -------
ALTER TABLE "TempVoiceConfig" DROP CONSTRAINT IF EXISTS "TempVoiceConfig_enabled_needs_lobby_check";
ALTER TABLE "TempVoiceConfig" DROP CONSTRAINT IF EXISTS "TempVoiceConfig_lobbyChannelId_check";
ALTER TABLE "TempVoiceConfig" DROP CONSTRAINT IF EXISTS "TempVoiceConfig_categoryId_check";
ALTER TABLE "TempVoiceConfig" DROP CONSTRAINT IF EXISTS "TempVoiceConfig_defaultUserLimit_check";
ALTER TABLE "TempVoiceConfig" DROP CONSTRAINT IF EXISTS "TempVoiceConfig_nameTemplate_check";

ALTER TABLE "TempVoiceConfig"
  DROP COLUMN "allowSoundboardByDefault",
  DROP COLUMN "allowVideoByDefault",
  DROP COLUMN "categoryId",
  DROP COLUMN "defaultUserLimit",
  DROP COLUMN "lobbyChannelId",
  DROP COLUMN "nameTemplate";

-- 5. Hand-written checks (Prisma can't express these) -------------------------------
ALTER TABLE "TempVoiceLobby" ADD CONSTRAINT "TempVoiceLobby_channelId_check" CHECK ("channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "TempVoiceLobby" ADD CONSTRAINT "TempVoiceLobby_categoryId_check"
  CHECK ("categoryId" IS NULL OR "categoryId" ~ '^[0-9]{17,20}$');
-- Discord allows 0 (no limit) to 99 members in a voice channel.
ALTER TABLE "TempVoiceLobby" ADD CONSTRAINT "TempVoiceLobby_defaultUserLimit_check" CHECK ("defaultUserLimit" BETWEEN 0 AND 99);
ALTER TABLE "TempVoiceLobby" ADD CONSTRAINT "TempVoiceLobby_nameTemplate_check" CHECK (length(btrim("nameTemplate")) > 0);

ALTER TABLE "TempVoiceChannel" ADD CONSTRAINT "TempVoiceChannel_lobbyChannelId_check"
  CHECK ("lobbyChannelId" IS NULL OR "lobbyChannelId" ~ '^[0-9]{17,20}$');
