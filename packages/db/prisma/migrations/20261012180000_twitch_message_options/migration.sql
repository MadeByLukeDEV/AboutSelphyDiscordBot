-- AlterTable
ALTER TABLE "TwitchStreamer" ADD COLUMN     "embedColor" INTEGER NOT NULL DEFAULT 9520895,
ADD COLUMN     "showGame" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showThumbnail" BOOLEAN NOT NULL DEFAULT true;


-- Hand-written CHECK constraint (Prisma can't express it): a 24-bit RGB colour.
ALTER TABLE "TwitchStreamer" ADD CONSTRAINT "TwitchStreamer_embedColor_range" CHECK ("embedColor" BETWEEN 0 AND 16777215);
