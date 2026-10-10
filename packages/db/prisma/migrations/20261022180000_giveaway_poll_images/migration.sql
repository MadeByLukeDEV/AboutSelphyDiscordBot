-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN     "imageUrl" VARCHAR(500) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Poll" ADD COLUMN     "imageUrl" VARCHAR(500) NOT NULL DEFAULT '';

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_image_https" CHECK ("imageUrl" = '' OR "imageUrl" ~ '^https://');
ALTER TABLE "Poll" ADD CONSTRAINT "Poll_image_https" CHECK ("imageUrl" = '' OR "imageUrl" ~ '^https://');
