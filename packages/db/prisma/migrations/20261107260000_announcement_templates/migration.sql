-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "repeat" VARCHAR(8) NOT NULL DEFAULT 'none';
ALTER TABLE "Announcement" ADD COLUMN "repeatUntil" TIMESTAMP(3);
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_repeat_valid" CHECK ("repeat" IN ('none', 'daily', 'weekly', 'monthly'));

-- CreateTable
CREATE TABLE "AnnouncementTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "content" VARCHAR(2000) NOT NULL DEFAULT '',
    "embedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "embedTitle" VARCHAR(256) NOT NULL DEFAULT '',
    "embedDescription" VARCHAR(4000) NOT NULL DEFAULT '',
    "embedColor" INTEGER NOT NULL DEFAULT 65448,
    "embedImageUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "channelId" VARCHAR(20),
    "pingRoleId" VARCHAR(20),
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnouncementTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementTemplate_name_key" ON "AnnouncementTemplate"("name");

ALTER TABLE "AnnouncementTemplate" ADD CONSTRAINT "AnnouncementTemplate_name_not_empty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "AnnouncementTemplate" ADD CONSTRAINT "AnnouncementTemplate_ids_valid" CHECK (("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$') AND ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$'));
