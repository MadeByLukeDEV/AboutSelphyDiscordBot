-- CreateTable
CREATE TABLE "EventSource" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "overviewChannelId" VARCHAR(20),
    "overviewMessageId" VARCHAR(20),
    "overviewHash" VARCHAR(40) NOT NULL DEFAULT '',
    "overviewDays" INTEGER NOT NULL DEFAULT 30,
    "summaryChannelId" VARCHAR(20),
    "summaryMonth" VARCHAR(7),
    "summaryMessageIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "summaryHash" VARCHAR(40) NOT NULL DEFAULT '',
    "baselined" BOOLEAN NOT NULL DEFAULT true,
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatus" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSource_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "EventRule" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "EventArticle" ADD COLUMN "sourceId" TEXT;

-- AddForeignKey
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventArticle" ADD CONSTRAINT "EventArticle_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "EventRule_sourceId_idx" ON "EventRule"("sourceId");
CREATE INDEX "EventArticle_sourceId_idx" ON "EventArticle"("sourceId");

ALTER TABLE "EventSource" ADD CONSTRAINT "EventSource_name_nonempty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "EventSource" ADD CONSTRAINT "EventSource_days_range" CHECK ("overviewDays" BETWEEN 7 AND 90);
ALTER TABLE "EventSource" ADD CONSTRAINT "EventSource_channels_valid" CHECK (("overviewChannelId" IS NULL OR "overviewChannelId" ~ '^[0-9]{17,20}$') AND ("summaryChannelId" IS NULL OR "summaryChannelId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "EventSource" ADD CONSTRAINT "EventSource_ids_max" CHECK (cardinality("summaryMessageIds") <= 10);
