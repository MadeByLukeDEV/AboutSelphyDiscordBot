-- AlterTable
ALTER TABLE "FeedSource" ADD COLUMN "includeWords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FeedSource" ADD COLUMN "excludeWords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "FeedSource" ADD COLUMN "useEmbed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "FeedSource" ADD CONSTRAINT "FeedSource_words_max" CHECK (cardinality("includeWords") <= 10 AND cardinality("excludeWords") <= 10);
