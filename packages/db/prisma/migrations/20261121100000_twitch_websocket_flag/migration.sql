-- AlterTable
ALTER TABLE "TwitchStreamer" ADD COLUMN "useWebsocket" BOOLEAN NOT NULL DEFAULT false;

-- Until now the five oldest enabled channels used the WebSocket: keep exactly that.
UPDATE "TwitchStreamer" SET "useWebsocket" = true
WHERE "id" IN (SELECT "id" FROM "TwitchStreamer" WHERE "enabled" = true ORDER BY "createdAt" ASC LIMIT 5);
