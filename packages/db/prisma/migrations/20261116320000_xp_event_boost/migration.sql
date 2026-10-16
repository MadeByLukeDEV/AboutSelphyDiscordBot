ALTER TABLE "LevelConfig" ADD COLUMN "eventBoostPercent" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "LevelConfig" ADD COLUMN "eventBoostUntil" TIMESTAMP(3);
ALTER TABLE "LevelConfig" ADD CONSTRAINT "LevelConfig_eventBoost_check" CHECK ("eventBoostPercent" >= 100 AND "eventBoostPercent" <= 500 AND ("eventBoostPercent" = 100 OR "eventBoostUntil" IS NOT NULL));
