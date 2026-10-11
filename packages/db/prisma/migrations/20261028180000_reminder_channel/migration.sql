-- AlterTable
ALTER TABLE "ReminderConfig" ADD COLUMN "channelId" VARCHAR(20);

-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "delivery" VARCHAR(8) NOT NULL DEFAULT 'dm';

-- A reminder is delivered by DM or in the channel, nothing else.
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_delivery_valid" CHECK ("delivery" IN ('dm', 'channel'));
