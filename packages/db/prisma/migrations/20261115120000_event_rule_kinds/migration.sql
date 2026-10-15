-- AlterTable
ALTER TABLE "EventRule" ADD COLUMN "kinds" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_kinds_valid" CHECK ("kinds" <@ ARRAY['drop', 'event', 'update', 'sale', 'other']::TEXT[]);
