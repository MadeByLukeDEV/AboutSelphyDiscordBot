-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed');

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'draft',
    "content" VARCHAR(2000) NOT NULL DEFAULT '',
    "embedEnabled" BOOLEAN NOT NULL DEFAULT false,
    "embedTitle" VARCHAR(256) NOT NULL DEFAULT '',
    "embedDescription" VARCHAR(4000) NOT NULL DEFAULT '',
    "embedColor" INTEGER NOT NULL DEFAULT 65448,
    "embedImageUrl" VARCHAR(500) NOT NULL DEFAULT '',
    "channelId" VARCHAR(20) NOT NULL,
    "pingRoleId" VARCHAR(20),
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "messageId" VARCHAR(20),
    "lastError" VARCHAR(40) NOT NULL DEFAULT '',
    "createdByUserId" VARCHAR(64) NOT NULL,
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Announcement_status_scheduledFor_idx" ON "Announcement"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_ids_digits"
  CHECK ("channelId" ~ '^[0-9]{17,20}$'
         AND ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$')
         AND ("messageId" IS NULL OR "messageId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_embedColor_range" CHECK ("embedColor" BETWEEN 0 AND 16777215);
-- Something has to be posted: text, or an embed with a title or description.
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_has_content"
  CHECK ("content" <> '' OR ("embedEnabled" AND ("embedTitle" <> '' OR "embedDescription" <> '')));
-- Only https pictures.
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_image_https" CHECK ("embedImageUrl" = '' OR "embedImageUrl" ~ '^https://');
-- A scheduled (or sending) announcement knows when; a sent one knows its message.
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_scheduled_has_time"
  CHECK ("status" NOT IN ('scheduled', 'sending') OR "scheduledFor" IS NOT NULL);
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_sent_has_message"
  CHECK ("status" <> 'sent' OR ("messageId" IS NOT NULL AND "sentAt" IS NOT NULL));
