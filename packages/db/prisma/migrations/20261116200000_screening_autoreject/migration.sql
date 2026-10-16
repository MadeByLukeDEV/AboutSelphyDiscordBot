ALTER TABLE "ScreeningConfig" ADD COLUMN "autoRejectDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ScreeningConfig" ADD CONSTRAINT "ScreeningConfig_autoRejectDays_check" CHECK ("autoRejectDays" >= 0 AND "autoRejectDays" <= 60);
