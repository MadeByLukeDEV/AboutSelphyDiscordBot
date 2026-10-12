-- AlterTable
ALTER TABLE "Poll" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Poll" ADD COLUMN "remindBeforeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Poll" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_remindBeforeMinutes_range" CHECK ("remindBeforeMinutes" BETWEEN 0 AND 10080);
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_remind_needs_end" CHECK ("remindBeforeMinutes" = 0 OR "endsAt" IS NOT NULL);
