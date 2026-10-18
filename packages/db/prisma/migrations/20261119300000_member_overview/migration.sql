CREATE TABLE "MemberOverview" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "channelId" VARCHAR(20),
    "language" VARCHAR(2) NOT NULL DEFAULT 'en',
    "color" VARCHAR(7) NOT NULL DEFAULT '#00FFA8',
    "messageIds" TEXT[],
    "postedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberOverview_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "MemberOverview" ADD CONSTRAINT "MemberOverview_singleton" CHECK ("id" = 1);
ALTER TABLE "MemberOverview" ADD CONSTRAINT "MemberOverview_valid" CHECK ("language" IN ('en', 'de') AND "color" ~ '^#[0-9a-fA-F]{6}$' AND ("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$'));
