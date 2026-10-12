-- AlterTable
ALTER TABLE "Suggestion" ADD COLUMN "mergedIntoNumber" INTEGER;

-- CreateTable
CREATE TABLE "SuggestionComment" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "authorName" VARCHAR(100) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuggestionComment_suggestionId_createdAt_idx" ON "SuggestionComment"("suggestionId", "createdAt");

-- AddForeignKey
ALTER TABLE "SuggestionComment" ADD CONSTRAINT "SuggestionComment_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A note is never empty.
ALTER TABLE "SuggestionComment" ADD CONSTRAINT "SuggestionComment_body_not_empty" CHECK (length(btrim("body")) > 0);
