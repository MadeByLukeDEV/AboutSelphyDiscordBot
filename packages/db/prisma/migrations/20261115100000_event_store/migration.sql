-- AlterTable
ALTER TABLE "EventSource" ADD COLUMN "icsUrl" VARCHAR(500);
ALTER TABLE "EventSource" ADD COLUMN "pageUrlTemplate" VARCHAR(300);
ALTER TABLE "EventSource" ADD COLUMN "contentSelector" VARCHAR(200);
ALTER TABLE "EventSource" ADD COLUMN "fetchMode" VARCHAR(10) NOT NULL DEFAULT 'auto';
ALTER TABLE "EventSource" ADD COLUMN "lastFetchedAt" TIMESTAMP(3);
ALTER TABLE "EventSource" ADD COLUMN "lastFetchStatus" VARCHAR(40);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "kind" VARCHAR(8) NOT NULL DEFAULT 'event',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "description" VARCHAR(4000) NOT NULL DEFAULT '',
    "summary" VARCHAR(600) NOT NULL DEFAULT '',
    "blurb" VARCHAR(200) NOT NULL DEFAULT '',
    "audience" VARCHAR(10) NOT NULL DEFAULT 'unknown',
    "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "imageUrl" VARCHAR(500),
    "videoUrl" VARCHAR(500),
    "color" INTEGER,
    "origin" VARCHAR(10) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventFetch" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" VARCHAR(300) NOT NULL,
    "contentHash" VARCHAR(40) NOT NULL,
    "extractedJson" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventFetch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_sourceId_key_key" ON "GameEvent"("sourceId", "key");
CREATE INDEX "GameEvent_sourceId_startsAt_idx" ON "GameEvent"("sourceId", "startsAt");
CREATE UNIQUE INDEX "EventFetch_sourceId_url_key" ON "EventFetch"("sourceId", "url");

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventFetch" ADD CONSTRAINT "EventFetch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventSource" ADD CONSTRAINT "EventSource_fetchmode_valid" CHECK ("fetchMode" IN ('auto', 'plain', 'crawl4ai'));
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_kind_valid" CHECK ("kind" IN ('drop', 'event', 'update', 'sale', 'other'));
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_audience_valid" CHECK ("audience" IN ('everyone', 'partners', 'unknown'));
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_origin_valid" CHECK ("origin" IN ('calendar', 'article', 'manual'));
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_title_nonempty" CHECK (length(btrim("title")) > 0);
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_items_max" CHECK (cardinality("items") <= 30);

-- The main calendar becomes a normal source: copy its settings and state, and point its rules and articles at it.
INSERT INTO "EventSource" ("id", "name", "enabled", "overviewChannelId", "overviewMessageId", "overviewHash", "overviewDays", "summaryChannelId", "summaryMonth", "summaryMessageIds", "summaryHash", "baselined", "lastCheckedAt", "lastStatus", "icsUrl")
SELECT 'src_' || substr(md5(random()::text), 1, 20), 'Sea of Thieves', "enabled", "overviewChannelId", "overviewMessageId", "overviewHash", "overviewDays", "summaryChannelId", "summaryMonth", "summaryMessageIds", "summaryHash", "baselined", "lastCheckedAt", "lastStatus", "icsUrl"
FROM "EventCalendarConfig" WHERE "id" = 1;

UPDATE "EventRule" SET "sourceId" = (SELECT "id" FROM "EventSource" WHERE "icsUrl" IS NOT NULL ORDER BY "createdAt" LIMIT 1)
WHERE "sourceId" IS NULL AND EXISTS (SELECT 1 FROM "EventSource" WHERE "icsUrl" IS NOT NULL);
UPDATE "EventArticle" SET "sourceId" = (SELECT "id" FROM "EventSource" WHERE "icsUrl" IS NOT NULL ORDER BY "createdAt" LIMIT 1)
WHERE "sourceId" IS NULL AND EXISTS (SELECT 1 FROM "EventSource" WHERE "icsUrl" IS NOT NULL);
