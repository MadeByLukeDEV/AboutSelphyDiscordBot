-- CreateTable
CREATE TABLE "StatChannel" (
    "id" TEXT NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "template" VARCHAR(90) NOT NULL,
    "lastName" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatChannel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StatChannel_channelId_key" ON "StatChannel"("channelId");

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "StatChannel" ADD CONSTRAINT "StatChannel_channel_digits" CHECK ("channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "StatChannel" ADD CONSTRAINT "StatChannel_kind" CHECK ("kind" IN ('members', 'humans', 'bots', 'boosts', 'channels', 'roles', 'voice'));
ALTER TABLE "StatChannel" ADD CONSTRAINT "StatChannel_template_has_count" CHECK (position('{count}' in "template") > 0);
