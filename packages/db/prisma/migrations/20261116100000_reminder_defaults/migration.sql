-- AlterTable
ALTER TABLE "EventSource" ADD COLUMN "reminderDefaults" JSONB NOT NULL DEFAULT '{}';
