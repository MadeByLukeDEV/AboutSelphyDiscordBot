-- AlterTable
ALTER TABLE "ModCase" ADD COLUMN     "pardonedAt" TIMESTAMP(3),
ADD COLUMN     "pardonedByName" VARCHAR(100),
ADD COLUMN     "pardonedByUserId" VARCHAR(64);


-- Hand-written: a case with a pardon timestamp must be inactive.
ALTER TABLE "ModCase" ADD CONSTRAINT "ModCase_pardon_check" CHECK ("pardonedAt" IS NULL OR "active" = false);
