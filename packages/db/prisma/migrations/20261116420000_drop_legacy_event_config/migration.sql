-- The single-calendar settings were copied into EventSource rows long ago and nothing reads them any more.
DROP TABLE "EventCalendarConfig";
-- Reminder times live on events, on the game's per-kind defaults and in EventRule.leadDays; this column only mirrored leadDays[0].
ALTER TABLE "EventRule" DROP CONSTRAINT IF EXISTS "EventRule_days_range";
ALTER TABLE "EventRule" DROP COLUMN "daysAhead";
