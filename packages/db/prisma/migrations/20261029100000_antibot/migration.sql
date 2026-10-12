-- CreateTable
CREATE TABLE "AntiBotConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 604800,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastHitAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AntiBotConfig_pkey" PRIMARY KEY ("id")
);

-- Singleton, Discord's timeout limits (1 minute to 28 days), and a channel whenever it is switched on.
ALTER TABLE "AntiBotConfig" ADD CONSTRAINT "AntiBotConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "AntiBotConfig" ADD CONSTRAINT "AntiBotConfig_timeout_range" CHECK ("timeoutSeconds" BETWEEN 60 AND 2419200);
ALTER TABLE "AntiBotConfig" ADD CONSTRAINT "AntiBotConfig_enabled_needs_channel" CHECK (NOT "enabled" OR "channelId" IS NOT NULL);
ALTER TABLE "AntiBotConfig" ADD CONSTRAINT "AntiBotConfig_hits_nonneg" CHECK ("hits" >= 0);
