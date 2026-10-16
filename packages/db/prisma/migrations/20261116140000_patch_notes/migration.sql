ALTER TABLE "EventSource" ADD COLUMN "patchListUrl" VARCHAR(300);
ALTER TABLE "EventSource" ADD COLUMN "patchChannelId" VARCHAR(20);
ALTER TABLE "EventSource" ADD COLUMN "patchPingRoleId" VARCHAR(20);
ALTER TABLE "EventSource" ADD COLUMN "patchBaselined" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "EventSource" ADD COLUMN "patchCheckedAt" TIMESTAMP(3);
ALTER TABLE "EventSource" ADD COLUMN "patchStatus" VARCHAR(40);

CREATE TABLE "PatchNote" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" VARCHAR(300) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "messageId" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PatchNote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PatchNote_sourceId_url_key" ON "PatchNote"("sourceId", "url");
ALTER TABLE "PatchNote" ADD CONSTRAINT "PatchNote_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
