-- CreateTable
CREATE TABLE "ScreeningConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "approvedRoleId" VARCHAR(20),
    "pendingRoleId" VARCHAR(20),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreeningConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreeningEntry" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "userName" VARCHAR(100) NOT NULL,
    "accountCreatedAt" TIMESTAMP(3) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" VARCHAR(10) NOT NULL DEFAULT 'pending',
    "decidedByName" VARCHAR(100),
    "decidedAt" TIMESTAMP(3),
    "channelId" VARCHAR(20),
    "messageId" VARCHAR(20),

    CONSTRAINT "ScreeningEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreeningEntry_status_joinedAt_idx" ON "ScreeningEntry"("status", "joinedAt");
CREATE INDEX "ScreeningEntry_userId_idx" ON "ScreeningEntry"("userId");

-- Singleton, a channel and the approved role whenever it is on, only known statuses.
ALTER TABLE "ScreeningConfig" ADD CONSTRAINT "ScreeningConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "ScreeningConfig" ADD CONSTRAINT "ScreeningConfig_enabled_needs_setup" CHECK (NOT "enabled" OR ("channelId" IS NOT NULL AND "approvedRoleId" IS NOT NULL));
ALTER TABLE "ScreeningEntry" ADD CONSTRAINT "ScreeningEntry_status_valid" CHECK ("status" IN ('pending', 'approved', 'rejected', 'left'));
