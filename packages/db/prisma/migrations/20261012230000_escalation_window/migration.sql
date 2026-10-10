-- AlterTable
ALTER TABLE "ModConfig" ADD COLUMN     "escalationWindowDays" INTEGER;


-- Hand-written CHECK constraint (Prisma can't express it): a window is 1 day to a year.
ALTER TABLE "ModConfig" ADD CONSTRAINT "ModConfig_escalationWindowDays_range"
  CHECK ("escalationWindowDays" IS NULL OR "escalationWindowDays" BETWEEN 1 AND 365);
