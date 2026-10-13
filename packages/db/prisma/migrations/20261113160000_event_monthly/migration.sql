-- AlterTable
ALTER TABLE "EventCalendarConfig" ADD COLUMN "summaryChannelId" VARCHAR(20);
ALTER TABLE "EventCalendarConfig" ADD COLUMN "summaryMonth" VARCHAR(7);
ALTER TABLE "EventCalendarConfig" ADD COLUMN "summaryMessageIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "EventCalendarConfig" ADD COLUMN "summaryHash" VARCHAR(40) NOT NULL DEFAULT '';
ALTER TABLE "EventCalendarConfig" ADD CONSTRAINT "EventCalendarConfig_summary_channel_valid" CHECK ("summaryChannelId" IS NULL OR "summaryChannelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "EventCalendarConfig" ADD CONSTRAINT "EventCalendarConfig_summary_ids_max" CHECK (cardinality("summaryMessageIds") <= 10);
