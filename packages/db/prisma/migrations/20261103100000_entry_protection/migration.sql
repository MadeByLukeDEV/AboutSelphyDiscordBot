-- CreateTable
CREATE TABLE "VerificationConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "panelMessageId" VARCHAR(20),
    "verifiedRoleId" VARCHAR(20),
    "unverifiedRoleId" VARCHAR(20),
    "panelTitle" VARCHAR(256) NOT NULL DEFAULT 'Welcome! Please verify',
    "panelDescription" VARCHAR(2000) NOT NULL DEFAULT 'Press the button below to confirm you are a real person and get access to the server.',
    "buttonLabel" VARCHAR(80) NOT NULL DEFAULT 'Verify',
    "question" VARCHAR(200) NOT NULL DEFAULT '',
    "answer" VARCHAR(100) NOT NULL DEFAULT '',
    "minAccountAgeDays" INTEGER NOT NULL DEFAULT 0,
    "kickAfterHours" INTEGER NOT NULL DEFAULT 0,
    "enabledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "joinThreshold" INTEGER NOT NULL DEFAULT 8,
    "windowSeconds" INTEGER NOT NULL DEFAULT 30,
    "action" VARCHAR(8) NOT NULL DEFAULT 'alert',
    "actionMinutes" INTEGER NOT NULL DEFAULT 60,
    "raidMinutes" INTEGER NOT NULL DEFAULT 20,
    "activeUntil" TIMESTAMP(3),
    "lastRaidAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidConfig_pkey" PRIMARY KEY ("id")
);

-- Singletons, a channel and a role whenever the gate is on, sane numbers.
ALTER TABLE "VerificationConfig" ADD CONSTRAINT "VerificationConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "VerificationConfig" ADD CONSTRAINT "VerificationConfig_enabled_needs_setup" CHECK (NOT "enabled" OR ("channelId" IS NOT NULL AND "verifiedRoleId" IS NOT NULL));
ALTER TABLE "VerificationConfig" ADD CONSTRAINT "VerificationConfig_age_range" CHECK ("minAccountAgeDays" BETWEEN 0 AND 365);
ALTER TABLE "VerificationConfig" ADD CONSTRAINT "VerificationConfig_kick_range" CHECK ("kickAfterHours" BETWEEN 0 AND 720);
ALTER TABLE "RaidConfig" ADD CONSTRAINT "RaidConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "RaidConfig" ADD CONSTRAINT "RaidConfig_action_valid" CHECK ("action" IN ('alert', 'timeout', 'kick'));
ALTER TABLE "RaidConfig" ADD CONSTRAINT "RaidConfig_numbers_range" CHECK ("joinThreshold" BETWEEN 3 AND 100 AND "windowSeconds" BETWEEN 5 AND 300 AND "actionMinutes" BETWEEN 1 AND 1440 AND "raidMinutes" BETWEEN 1 AND 180);
