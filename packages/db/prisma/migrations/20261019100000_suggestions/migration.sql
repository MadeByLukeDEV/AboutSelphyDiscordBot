-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('open', 'approved', 'denied', 'implemented');

-- CreateTable
CREATE TABLE "SuggestionConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "cooldownSeconds" INTEGER NOT NULL DEFAULT 60,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "authorId" VARCHAR(20) NOT NULL,
    "authorName" VARCHAR(100) NOT NULL DEFAULT '',
    "content" VARCHAR(1500) NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'open',
    "channelId" VARCHAR(20) NOT NULL,
    "messageId" VARCHAR(20) NOT NULL,
    "decidedById" VARCHAR(20),
    "decidedByName" VARCHAR(100),
    "decisionReason" VARCHAR(300) NOT NULL DEFAULT '',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionVote" (
    "suggestionId" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionVote_pkey" PRIMARY KEY ("suggestionId","userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Suggestion_number_key" ON "Suggestion"("number");

-- CreateIndex
CREATE INDEX "Suggestion_status_createdAt_idx" ON "Suggestion"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Suggestion_authorId_createdAt_idx" ON "Suggestion"("authorId", "createdAt");

-- AddForeignKey
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "SuggestionConfig" ADD CONSTRAINT "SuggestionConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "SuggestionConfig" ADD CONSTRAINT "SuggestionConfig_channel_digits" CHECK ("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "SuggestionConfig" ADD CONSTRAINT "SuggestionConfig_cooldown_range" CHECK ("cooldownSeconds" BETWEEN 0 AND 3600 AND "nextNumber" >= 1);
ALTER TABLE "SuggestionConfig" ADD CONSTRAINT "SuggestionConfig_enabled_has_channel" CHECK (NOT "enabled" OR "channelId" IS NOT NULL);
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_ids_digits"
  CHECK ("authorId" ~ '^[0-9]{17,20}$' AND "channelId" ~ '^[0-9]{17,20}$' AND "messageId" ~ '^[0-9]{17,20}$'
     AND ("decidedById" IS NULL OR "decidedById" ~ '^[0-9]{17,20}$'));
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_number_positive" CHECK ("number" >= 1);
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_value" CHECK ("value" IN (1, -1));
ALTER TABLE "SuggestionVote" ADD CONSTRAINT "SuggestionVote_user_digits" CHECK ("userId" ~ '^[0-9]{17,20}$');
