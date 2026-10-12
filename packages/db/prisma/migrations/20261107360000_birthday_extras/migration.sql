-- AlterTable
ALTER TABLE "Birthday" ADD COLUMN "year" INTEGER;
ALTER TABLE "Birthday" ADD CONSTRAINT "Birthday_year_range" CHECK ("year" IS NULL OR "year" BETWEEN 1900 AND 2100);

ALTER TABLE "BirthdayConfig" ADD COLUMN "milestoneMessage" VARCHAR(300) NOT NULL DEFAULT '';
ALTER TABLE "BirthdayConfig" ADD COLUMN "monthlySummary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "BirthdayConfig" ADD COLUMN "lastSummaryMonth" VARCHAR(7);
