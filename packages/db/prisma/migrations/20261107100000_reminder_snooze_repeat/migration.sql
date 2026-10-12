-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN "repeatEverySeconds" INTEGER,
ADD COLUMN "repeatsLeft" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "snoozedAt" TIMESTAMP(3);

-- A repeat is at least an hour and at most a year apart; at most 52 more follow.
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_repeat_range" CHECK (("repeatEverySeconds" IS NULL OR "repeatEverySeconds" BETWEEN 3600 AND 31536000) AND "repeatsLeft" BETWEEN 0 AND 52);
