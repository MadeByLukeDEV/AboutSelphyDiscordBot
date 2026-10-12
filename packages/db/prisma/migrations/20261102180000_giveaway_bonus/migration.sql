-- AlterTable
ALTER TABLE "Giveaway" ADD COLUMN "bonusRoleId" VARCHAR(20),
ADD COLUMN "bonusEntries" INTEGER NOT NULL DEFAULT 0;

-- 0 to 10 extra chances, and only with a role that earns them.
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_bonus_range" CHECK ("bonusEntries" BETWEEN 0 AND 10);
ALTER TABLE "Giveaway" ADD CONSTRAINT "Giveaway_bonus_needs_role" CHECK ("bonusEntries" = 0 OR "bonusRoleId" IS NOT NULL);
