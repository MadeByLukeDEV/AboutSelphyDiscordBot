-- AlterTable
ALTER TABLE "LevelConfig" ADD COLUMN "publicLeaderboard" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MemberXp" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
