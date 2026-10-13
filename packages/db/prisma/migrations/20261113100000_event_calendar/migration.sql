-- CreateTable
CREATE TABLE "EventCalendarConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "icsUrl" VARCHAR(500) NOT NULL DEFAULT 'https://calendar.google.com/calendar/ical/c_10fomfvgafp5atjgb2t8i190i4%40group.calendar.google.com/public/basic.ics',
    "overviewChannelId" VARCHAR(20),
    "overviewMessageId" VARCHAR(20),
    "overviewHash" VARCHAR(40) NOT NULL DEFAULT '',
    "overviewDays" INTEGER NOT NULL DEFAULT 30,
    "baselined" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatus" VARCHAR(40),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCalendarConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRule" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "words" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channelId" VARCHAR(20) NOT NULL,
    "pingRoleId" VARCHAR(20),
    "daysAhead" INTEGER NOT NULL DEFAULT 7,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPost" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventKey" VARCHAR(160) NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "messageId" VARCHAR(20),
    "channelId" VARCHAR(20) NOT NULL,
    "hash" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventPost_ruleId_eventKey_key" ON "EventPost"("ruleId", "eventKey");
CREATE INDEX "EventPost_startsAt_idx" ON "EventPost"("startsAt");

-- AddForeignKey
ALTER TABLE "EventPost" ADD CONSTRAINT "EventPost_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "EventRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written checks
ALTER TABLE "EventCalendarConfig" ADD CONSTRAINT "EventCalendarConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "EventCalendarConfig" ADD CONSTRAINT "EventCalendarConfig_days_range" CHECK ("overviewDays" BETWEEN 7 AND 90);
ALTER TABLE "EventCalendarConfig" ADD CONSTRAINT "EventCalendarConfig_url_https" CHECK ("icsUrl" LIKE 'https://%');
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_days_range" CHECK ("daysAhead" BETWEEN 0 AND 60);
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_has_match" CHECK (cardinality("words") + cardinality("categories") > 0 AND cardinality("words") <= 10 AND cardinality("categories") <= 10);
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_ids_valid" CHECK ("channelId" ~ '^[0-9]{17,20}$' AND ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$'));
