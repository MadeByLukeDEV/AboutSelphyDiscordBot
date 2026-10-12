-- AlterTable
ALTER TABLE "TicketConfig" ADD COLUMN "askRating" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "categoryId" VARCHAR(40),
ADD COLUMN "categoryLabel" VARCHAR(80) NOT NULL DEFAULT '',
ADD COLUMN "rating" INTEGER;

-- CreateTable
CREATE TABLE "TicketCategory" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "emoji" VARCHAR(64) NOT NULL DEFAULT '',
    "discordCategoryId" VARCHAR(20),
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCategory_pkey" PRIMARY KEY ("id")
);

-- A rating is one to five stars.
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_rating_range" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 5);
