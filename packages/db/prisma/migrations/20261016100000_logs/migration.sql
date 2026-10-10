-- CreateTable
CREATE TABLE "LogRoute" (
    "id" TEXT NOT NULL,
    "category" VARCHAR(24) NOT NULL,
    "channelId" VARCHAR(20),
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogRoute_category_key" ON "LogRoute"("category");


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "LogRoute" ADD CONSTRAINT "LogRoute_category_known" CHECK ("category" IN ('members', 'memberUpdates', 'voice', 'server'));
ALTER TABLE "LogRoute" ADD CONSTRAINT "LogRoute_channel_digits" CHECK ("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "LogRoute" ADD CONSTRAINT "LogRoute_enabled_has_channel" CHECK (NOT "enabled" OR "channelId" IS NOT NULL);
