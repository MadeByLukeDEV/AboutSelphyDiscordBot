-- CreateEnum
CREATE TYPE "ModEscalationAction" AS ENUM ('timeout', 'kick', 'ban');

-- AlterTable
ALTER TABLE "ModConfig" ADD COLUMN     "escalationAction" "ModEscalationAction",
ADD COLUMN     "escalationDurationSeconds" INTEGER,
ADD COLUMN     "escalationThreshold" INTEGER;

-- AlterTable
ALTER TABLE "ModCase" ADD COLUMN     "expiryHandledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "ModCase_expiryHandledAt_expiresAt_idx" ON "ModCase"("expiryHandledAt", "expiresAt");


-- Hand-written CHECK constraints (Prisma can't express them).
-- An escalation is either fully off (no threshold) or has a threshold and an action;
-- a timeout needs a duration within Discord's limits (1 minute to 28 days).
ALTER TABLE "ModConfig" ADD CONSTRAINT "ModConfig_escalation_valid" CHECK (
  ("escalationThreshold" IS NULL AND "escalationAction" IS NULL AND "escalationDurationSeconds" IS NULL)
  OR (
    "escalationThreshold" BETWEEN 2 AND 20
    AND "escalationAction" IS NOT NULL
    AND (
      ("escalationAction" = 'timeout' AND "escalationDurationSeconds" BETWEEN 60 AND 2419200)
      OR ("escalationAction" = 'kick' AND "escalationDurationSeconds" IS NULL)
      OR ("escalationAction" = 'ban' AND ("escalationDurationSeconds" IS NULL OR "escalationDurationSeconds" >= 60))
    )
  )
);
