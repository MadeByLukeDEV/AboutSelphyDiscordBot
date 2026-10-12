-- AlterTable
ALTER TABLE "TempVoiceConfig" ADD COLUMN "afkMoveMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TempVoiceConfig" ADD CONSTRAINT "TempVoiceConfig_afkMoveMinutes_range" CHECK ("afkMoveMinutes" BETWEEN 0 AND 240);

-- CreateTable
CREATE TABLE "TempVoiceRoleRule" (
    "id" TEXT NOT NULL,
    "roleId" VARCHAR(20) NOT NULL,
    "bitrateKbps" INTEGER,
    "maxUserLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TempVoiceRoleRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TempVoiceRoleRule_roleId_key" ON "TempVoiceRoleRule"("roleId");

-- A role ID or the base rule, a sensible bitrate and limit, and at least one of them set.
ALTER TABLE "TempVoiceRoleRule" ADD CONSTRAINT "TempVoiceRoleRule_roleId_valid" CHECK ("roleId" = 'everyone' OR "roleId" ~ '^[0-9]{17,20}$');
ALTER TABLE "TempVoiceRoleRule" ADD CONSTRAINT "TempVoiceRoleRule_bitrate_range" CHECK ("bitrateKbps" IS NULL OR "bitrateKbps" BETWEEN 8 AND 384);
ALTER TABLE "TempVoiceRoleRule" ADD CONSTRAINT "TempVoiceRoleRule_limit_range" CHECK ("maxUserLimit" IS NULL OR "maxUserLimit" BETWEEN 1 AND 99);
ALTER TABLE "TempVoiceRoleRule" ADD CONSTRAINT "TempVoiceRoleRule_something_set" CHECK ("bitrateKbps" IS NOT NULL OR "maxUserLimit" IS NOT NULL);
