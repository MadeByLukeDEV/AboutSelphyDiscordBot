-- AlterEnum
ALTER TYPE "RolePanelStyle" ADD VALUE 'reactions';

-- AlterTable
ALTER TABLE "RolePanelRole" ALTER COLUMN "emoji" SET DATA TYPE VARCHAR(64);

