-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN "minAccountDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "minMemberDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "minLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "repeatsLeft" INTEGER NOT NULL DEFAULT 0;

-- Sane ranges.
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_requirements_range" CHECK ("minAccountDays" BETWEEN 0 AND 3650 AND "minMemberDays" BETWEEN 0 AND 3650 AND "minLevel" BETWEEN 0 AND 500);
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_repeats_range" CHECK ("repeatsLeft" BETWEEN 0 AND 52);
