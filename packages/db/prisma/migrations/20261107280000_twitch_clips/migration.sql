-- AlterTable
ALTER TABLE "TwitchConfig" ADD COLUMN "clipsChannelId" VARCHAR(20);
ALTER TABLE "TwitchConfig" ADD CONSTRAINT "TwitchConfig_clipsChannelId_valid" CHECK ("clipsChannelId" IS NULL OR "clipsChannelId" ~ '^[0-9]{17,20}$');

ALTER TABLE "TwitchStreamer" ADD COLUMN "postClips" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TwitchStreamer" ADD COLUMN "clipsCheckedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TwitchClip" (
    "id" TEXT NOT NULL,
    "clipId" VARCHAR(100) NOT NULL,
    "twitchUserId" VARCHAR(32) NOT NULL,
    "seenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitchClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitchClip_clipId_key" ON "TwitchClip"("clipId");
CREATE INDEX "TwitchClip_seenAt_idx" ON "TwitchClip"("seenAt");
