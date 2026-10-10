-- CreateTable
CREATE TABLE "CountingConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "highScore" INTEGER NOT NULL DEFAULT 0,
    "lastUserId" VARCHAR(20),
    "allowConsecutive" BOOLEAN NOT NULL DEFAULT false,
    "resetOnMistake" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CountingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoResponder" (
    "id" TEXT NOT NULL,
    "trigger" VARCHAR(100) NOT NULL,
    "matchType" VARCHAR(12) NOT NULL DEFAULT 'word',
    "response" VARCHAR(1500) NOT NULL,
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 30,
    "channelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoResponder_pkey" PRIMARY KEY ("id")
);

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "CountingConfig" ADD CONSTRAINT "CountingConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "CountingConfig" ADD CONSTRAINT "CountingConfig_ids_digits" CHECK (("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$') AND ("lastUserId" IS NULL OR "lastUserId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "CountingConfig" ADD CONSTRAINT "CountingConfig_counts" CHECK ("currentCount" >= 0 AND "highScore" >= 0 AND "highScore" >= "currentCount");
ALTER TABLE "CountingConfig" ADD CONSTRAINT "CountingConfig_enabled_has_channel" CHECK (NOT "enabled" OR "channelId" IS NOT NULL);
ALTER TABLE "AutoResponder" ADD CONSTRAINT "AutoResponder_match_type" CHECK ("matchType" IN ('word', 'contains', 'exact'));
ALTER TABLE "AutoResponder" ADD CONSTRAINT "AutoResponder_trigger_not_empty" CHECK (length(btrim("trigger")) > 0 AND length(btrim("response")) > 0);
ALTER TABLE "AutoResponder" ADD CONSTRAINT "AutoResponder_cooldown_range" CHECK ("cooldownSeconds" BETWEEN 0 AND 86400 AND "uses" >= 0);
ALTER TABLE "AutoResponder" ADD CONSTRAINT "AutoResponder_channels_limit" CHECK (cardinality("channelIds") <= 25);
