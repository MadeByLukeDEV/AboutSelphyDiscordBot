-- AlterTable
ALTER TABLE "StarboardConfig" ADD COLUMN "ignoredChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "StarboardConfig" SET "ignoredChannelIds" = ARRAY[]::TEXT[] WHERE "ignoredChannelIds" IS NULL;
ALTER TABLE "StarboardConfig" ALTER COLUMN "ignoredChannelIds" SET NOT NULL;
ALTER TABLE "StarboardConfig" ADD CONSTRAINT "StarboardConfig_ignored_max" CHECK (cardinality("ignoredChannelIds") <= 30);
