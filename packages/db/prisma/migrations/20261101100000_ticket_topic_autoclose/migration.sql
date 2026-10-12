-- AlterTable
ALTER TABLE "TicketConfig" ADD COLUMN "askReason" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "autoCloseHours" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "topic" VARCHAR(300) NOT NULL DEFAULT '',
ADD COLUMN "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Ticket_status_lastActivityAt_idx" ON "Ticket"("status", "lastActivityAt");

-- Never more than 30 days, never negative.
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_autoclose_range" CHECK ("autoCloseHours" BETWEEN 0 AND 720);
