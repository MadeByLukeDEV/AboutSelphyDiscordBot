-- CreateEnum
CREATE TYPE "ModCaseType" AS ENUM ('warn', 'timeout', 'untimeout', 'kick', 'ban', 'unban', 'note', 'antibot');

-- CreateEnum
CREATE TYPE "ModCaseSource" AS ENUM ('command', 'dashboard', 'audit_log', 'automod');

-- CreateTable
CREATE TABLE "ModConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nextCaseNumber" INTEGER NOT NULL DEFAULT 1,
    "logChannelId" VARCHAR(20),
    "dmOnAction" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModCase" (
    "id" TEXT NOT NULL,
    "caseNumber" INTEGER NOT NULL,
    "type" "ModCaseType" NOT NULL,
    "source" "ModCaseSource" NOT NULL,
    "targetId" VARCHAR(20) NOT NULL,
    "targetName" VARCHAR(100),
    "moderatorId" VARCHAR(20) NOT NULL,
    "moderatorName" VARCHAR(100),
    "reason" VARCHAR(1000),
    "durationSeconds" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "logChannelId" VARCHAR(20),
    "logMessageId" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModCase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModCase_caseNumber_key" ON "ModCase"("caseNumber");

-- CreateIndex
CREATE INDEX "ModCase_targetId_createdAt_idx" ON "ModCase"("targetId", "createdAt");

-- CreateIndex
CREATE INDEX "ModCase_type_createdAt_idx" ON "ModCase"("type", "createdAt");


-- Hand-written (Prisma can't express these) -------------------------------

-- ModConfig is a singleton.
ALTER TABLE "ModConfig" ADD CONSTRAINT "ModConfig_singleton_check" CHECK ("id" = 1);
ALTER TABLE "ModConfig" ADD CONSTRAINT "ModConfig_nextCaseNumber_check" CHECK ("nextCaseNumber" >= 1);

-- Discord IDs are digits only (17-20 chars), never free text.
ALTER TABLE "ModConfig" ADD CONSTRAINT "ModConfig_logChannelId_check"
  CHECK ("logChannelId" IS NULL OR "logChannelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_targetId_check" CHECK ("targetId" ~ '^[0-9]{17,20}$');
-- "system" = an automatic rule acted, not a person.
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_moderatorId_check"
  CHECK ("moderatorId" = 'system' OR "moderatorId" ~ '^[0-9]{17,20}$');
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_logChannelId_check"
  CHECK ("logChannelId" IS NULL OR "logChannelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_logMessageId_check"
  CHECK ("logMessageId" IS NULL OR "logMessageId" ~ '^[0-9]{17,20}$');
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_durationSeconds_check"
  CHECK ("durationSeconds" IS NULL OR "durationSeconds" > 0);

-- The one config row; the case counter increments it atomically.
INSERT INTO "ModConfig" ("id", "updatedAt") VALUES (1, CURRENT_TIMESTAMP) ON CONFLICT ("id") DO NOTHING;
