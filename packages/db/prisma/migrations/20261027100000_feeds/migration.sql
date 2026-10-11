-- CreateTable
CREATE TABLE "FeedSource" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "urlEnc" TEXT NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "pingRoleId" VARCHAR(20),
    "messageTemplate" VARCHAR(300) NOT NULL DEFAULT '{name}: {title} {link}',
    "intervalMinutes" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "baselined" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastStatus" VARCHAR(24),
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedItem" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "guid" VARCHAR(300) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedItem_feedId_guid_key" ON "FeedItem"("feedId", "guid");

-- AddForeignKey
ALTER TABLE "FeedItem" ADD CONSTRAINT "FeedItem_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "FeedSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "FeedSource" ADD CONSTRAINT "FeedSource_ids_digits" CHECK ("channelId" ~ '^[0-9]{17,20}$' AND ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "FeedSource" ADD CONSTRAINT "FeedSource_interval_range" CHECK ("intervalMinutes" BETWEEN 5 AND 1440);
ALTER TABLE "FeedSource" ADD CONSTRAINT "FeedSource_not_empty" CHECK (length(btrim("name")) > 0 AND length(btrim("messageTemplate")) > 0);
