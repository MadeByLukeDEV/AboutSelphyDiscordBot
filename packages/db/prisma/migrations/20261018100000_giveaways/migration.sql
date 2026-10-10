-- CreateEnum
CREATE TYPE "GiveawayStatus" AS ENUM ('draft', 'active', 'ended', 'cancelled');

-- CreateTable
CREATE TABLE "Giveaway" (
    "id" TEXT NOT NULL,
    "status" "GiveawayStatus" NOT NULL DEFAULT 'draft',
    "channelId" VARCHAR(20) NOT NULL,
    "messageId" VARCHAR(20),
    "prize" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000) NOT NULL DEFAULT '',
    "winnerCount" INTEGER NOT NULL DEFAULT 1,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "requiredRoleId" VARCHAR(20),
    "pingRoleId" VARCHAR(20),
    "hostName" VARCHAR(100) NOT NULL,
    "hostUserId" VARCHAR(64) NOT NULL,
    "winners" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiveawayEntry" (
    "giveawayId" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiveawayEntry_pkey" PRIMARY KEY ("giveawayId","userId")
);

-- CreateIndex
CREATE INDEX "Giveaway_status_endsAt_idx" ON "Giveaway"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_ids_digits"
  CHECK ("channelId" ~ '^[0-9]{17,20}$' AND ("messageId" IS NULL OR "messageId" ~ '^[0-9]{17,20}$')
     AND ("requiredRoleId" IS NULL OR "requiredRoleId" ~ '^[0-9]{17,20}$') AND ("pingRoleId" IS NULL OR "pingRoleId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_winner_count" CHECK ("winnerCount" BETWEEN 1 AND 20);
-- A running giveaway has been posted.
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_active_has_message" CHECK ("status" <> 'active' OR "messageId" IS NOT NULL);
ALTER TABLE "GiveawayEntry" ADD CONSTRAINT "GiveawayEntry_user_digits" CHECK ("userId" ~ '^[0-9]{17,20}$');
