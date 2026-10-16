ALTER TABLE "TwitchConfig" ADD COLUMN "clipsMinViews" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TwitchConfig" ADD CONSTRAINT "TwitchConfig_clipsMinViews_check" CHECK ("clipsMinViews" >= 0 AND "clipsMinViews" <= 100000);
