-- CreateTable
CREATE TABLE "StickyMessage" (
    "id" TEXT NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "content" VARCHAR(1500) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageId" VARCHAR(20),
    "dirty" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StickyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoPublishChannel" (
    "channelId" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutoPublishChannel_pkey" PRIMARY KEY ("channelId")
);

-- CreateIndex
CREATE UNIQUE INDEX "StickyMessage_channelId_key" ON "StickyMessage"("channelId");

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "StickyMessage" ADD CONSTRAINT "StickyMessage_ids_digits" CHECK ("channelId" ~ '^[0-9]{17,20}$' AND ("lastMessageId" IS NULL OR "lastMessageId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "StickyMessage" ADD CONSTRAINT "StickyMessage_content_not_empty" CHECK (length(btrim("content")) > 0);
ALTER TABLE "AutoPublishChannel" ADD CONSTRAINT "AutoPublishChannel_digits" CHECK ("channelId" ~ '^[0-9]{17,20}$');
