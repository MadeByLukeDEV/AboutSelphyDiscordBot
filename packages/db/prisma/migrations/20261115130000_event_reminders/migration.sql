-- AlterTable
ALTER TABLE "EventRule" ADD COLUMN "leadDays" INTEGER[] DEFAULT ARRAY[7]::INTEGER[];
UPDATE "EventRule" SET "leadDays" = ARRAY["daysAhead"]::INTEGER[];
ALTER TABLE "EventRule" ADD CONSTRAINT "EventRule_leaddays_valid" CHECK (cardinality("leadDays") BETWEEN 1 AND 4);

-- One post per rule, occurrence and stage (announcement + reminders)
ALTER TABLE "EventPost" ADD COLUMN "stage" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "EventPost_ruleId_eventKey_key";
CREATE UNIQUE INDEX "EventPost_ruleId_eventKey_stage_key" ON "EventPost"("ruleId", "eventKey", "stage");

ALTER TABLE "GameEvent" ADD COLUMN "reminderDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_reminderdays_max" CHECK (cardinality("reminderDays") <= 4);

ALTER TABLE "EventSource" ADD COLUMN "summaryAuto" BOOLEAN NOT NULL DEFAULT false;
