-- CreateEnum
CREATE TYPE "PollStatus" AS ENUM ('draft', 'active', 'ended');

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "status" "PollStatus" NOT NULL DEFAULT 'draft',
    "channelId" VARCHAR(20) NOT NULL,
    "messageId" VARCHAR(20),
    "question" VARCHAR(300) NOT NULL,
    "options" TEXT[],
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "endsAt" TIMESTAMP(3),
    "createdById" VARCHAR(64) NOT NULL,
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "pollId" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "optionIndex" INTEGER NOT NULL,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("pollId","userId","optionIndex")
);

-- CreateIndex
CREATE INDEX "Poll_status_endsAt_idx" ON "Poll"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_ids_digits" CHECK ("channelId" ~ '^[0-9]{17,20}$' AND ("messageId" IS NULL OR "messageId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_option_count" CHECK (cardinality("options") BETWEEN 2 AND 10);
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_active_has_message" CHECK ("status" <> 'active' OR "messageId" IS NOT NULL);
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_user_digits" CHECK ("userId" ~ '^[0-9]{17,20}$');
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_option_range" CHECK ("optionIndex" BETWEEN 0 AND 9);
