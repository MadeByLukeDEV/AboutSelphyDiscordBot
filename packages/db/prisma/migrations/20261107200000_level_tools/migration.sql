-- AlterTable
ALTER TABLE "LevelConfig" ADD COLUMN "voiceRequiresUnmuted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LevelConfig" ADD COLUMN "resetEvery" VARCHAR(8) NOT NULL DEFAULT 'off';
ALTER TABLE "LevelConfig" ADD COLUMN "lastResetAt" TIMESTAMP(3);

ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_resetEvery_valid" CHECK ("resetEvery" IN ('off', 'weekly', 'monthly'));
