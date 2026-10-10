-- CreateTable
CREATE TABLE "TwitchConnection" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "twitchUserId" VARCHAR(32) NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "needsReconnect" BOOLEAN NOT NULL DEFAULT false,
    "connectedByName" VARCHAR(100),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "markEndedOnOffline" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchStreamer" (
    "id" TEXT NOT NULL,
    "twitchUserId" VARCHAR(32) NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "pingRoleId" VARCHAR(20),
    "messageTemplate" VARCHAR(300) NOT NULL DEFAULT '{name} is live: {title}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchStreamer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwitchNotification" (
    "id" TEXT NOT NULL,
    "twitchStreamId" VARCHAR(32) NOT NULL,
    "twitchUserId" VARCHAR(32) NOT NULL,
    "login" VARCHAR(64) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "title" VARCHAR(300) NOT NULL DEFAULT '',
    "game" VARCHAR(200) NOT NULL DEFAULT '',
    "channelId" VARCHAR(20) NOT NULL,
    "messageId" VARCHAR(20),
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TwitchNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TwitchStreamer_twitchUserId_key" ON "TwitchStreamer"("twitchUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TwitchNotification_twitchStreamId_key" ON "TwitchNotification"("twitchStreamId");

-- CreateIndex
CREATE INDEX "TwitchNotification_twitchUserId_endedAt_idx" ON "TwitchNotification"("twitchUserId", "endedAt");


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "TwitchConnection" ADD CONSTRAINT "TwitchConnection_singleton" CHECK ("id" = 1);
ALTER TABLE "TwitchConfig" ADD CONSTRAINT "TwitchConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "TwitchStreamer" ADD CONSTRAINT "TwitchStreamer_ids_digits"
  CHECK ("twitchUserId" ~ '^[0-9]{1,32}$' AND "channelId" ~ '^[0-9]{17,20}$'
         AND ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "TwitchNotification" ADD CONSTRAINT "TwitchNotification_ids_digits"
  CHECK ("twitchStreamId" ~ '^[0-9]{1,32}$' AND "twitchUserId" ~ '^[0-9]{1,32}$'
         AND "channelId" ~ '^[0-9]{17,20}$'
         AND ("messageId" IS NULL OR "messageId" ~ '^[0-9]{17,20}$'));
