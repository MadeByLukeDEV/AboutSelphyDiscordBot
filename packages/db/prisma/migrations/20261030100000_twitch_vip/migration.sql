-- CreateTable
CREATE TABLE "TwitchVipConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "roleId" VARCHAR(20),
    "status" VARCHAR(16) NOT NULL DEFAULT 'unknown',
    "vipCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchVipConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchVipLink" (
    "id" TEXT NOT NULL,
    "discordUserId" VARCHAR(20) NOT NULL,
    "discordName" VARCHAR(100) NOT NULL,
    "twitchUserId" VARCHAR(32) NOT NULL,
    "twitchLogin" VARCHAR(64) NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "approvedByName" VARCHAR(100),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitchVipLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitchVipLink_discordUserId_key" ON "TwitchVipLink"("discordUserId");
CREATE UNIQUE INDEX "TwitchVipLink_twitchUserId_key" ON "TwitchVipLink"("twitchUserId");
CREATE INDEX "TwitchVipLink_approved_idx" ON "TwitchVipLink"("approved");

-- Singleton, known statuses, a role whenever it is switched on, a sane counter.
ALTER TABLE "TwitchVipConfig" ADD CONSTRAINT "TwitchVipConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "TwitchVipConfig" ADD CONSTRAINT "TwitchVipConfig_status_valid" CHECK ("status" IN ('unknown', 'ok', 'missingScope', 'notConnected', 'needsReconnect', 'unavailable'));
ALTER TABLE "TwitchVipConfig" ADD CONSTRAINT "TwitchVipConfig_enabled_needs_role" CHECK (NOT "enabled" OR "roleId" IS NOT NULL);
ALTER TABLE "TwitchVipConfig" ADD CONSTRAINT "TwitchVipConfig_count_nonneg" CHECK ("vipCount" >= 0);
-- An approved link says who approved it.
ALTER TABLE "TwitchVipLink" ADD CONSTRAINT "TwitchVipLink_approved_has_approver" CHECK (NOT "approved" OR ("approvedByName" IS NOT NULL AND "approvedAt" IS NOT NULL));
