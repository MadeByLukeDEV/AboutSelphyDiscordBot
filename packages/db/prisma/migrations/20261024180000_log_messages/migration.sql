-- The log kinds gain "messages" (edited and deleted messages). Only loosens a CHECK; no data changes.
ALTER TABLE "LogRoute" DROP CONSTRAINT "LogRoute_category_known";
ALTER TABLE "LogRoute" ADD CONSTRAINT "LogRoute_category_known" CHECK ("category" IN ('members', 'memberUpdates', 'voice', 'server', 'messages'));
