-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "TicketConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "panelChannelId" VARCHAR(20),
    "panelMessageId" VARCHAR(20),
    "categoryId" VARCHAR(20),
    "staffRoleIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logChannelId" VARCHAR(20),
    "maxOpenPerUser" INTEGER NOT NULL DEFAULT 1,
    "panelTitle" VARCHAR(256) NOT NULL DEFAULT 'Need help?',
    "panelDescription" VARCHAR(2000) NOT NULL DEFAULT 'Press the button to open a private ticket with the team.',
    "panelColor" INTEGER NOT NULL DEFAULT 65448,
    "buttonLabel" VARCHAR(80) NOT NULL DEFAULT 'Open a ticket',
    "welcomeTemplate" VARCHAR(1000) NOT NULL DEFAULT 'Hi {user}, thanks for opening ticket #{number}. Tell us what you need and the team will be with you soon.',
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "openerId" VARCHAR(20) NOT NULL,
    "openerName" VARCHAR(100) NOT NULL DEFAULT '',
    "status" "TicketStatus" NOT NULL DEFAULT 'open',
    "claimedById" VARCHAR(20),
    "claimedByName" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closedById" VARCHAR(20),
    "closedByName" VARCHAR(100),
    "closeReason" VARCHAR(300) NOT NULL DEFAULT '',
    "transcript" JSONB,
    "messageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_number_key" ON "Ticket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_channelId_key" ON "Ticket"("channelId");

-- CreateIndex
CREATE INDEX "Ticket_status_createdAt_idx" ON "Ticket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Ticket_openerId_status_idx" ON "Ticket"("openerId", "status");


-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_ids_digits"
  CHECK (("panelChannelId" IS NULL OR "panelChannelId" ~ '^[0-9]{17,20}$')
     AND ("panelMessageId" IS NULL OR "panelMessageId" ~ '^[0-9]{17,20}$')
     AND ("categoryId" IS NULL OR "categoryId" ~ '^[0-9]{17,20}$')
     AND ("logChannelId" IS NULL OR "logChannelId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_ranges" CHECK ("maxOpenPerUser" BETWEEN 1 AND 5 AND "panelColor" BETWEEN 0 AND 16777215 AND "nextNumber" >= 1);
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_staff_roles" CHECK (cardinality("staffRoleIds") <= 5);
-- Switched on needs a place for the panel, a category and at least one staff role.
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_enabled_complete"
  CHECK (NOT "enabled" OR ("panelChannelId" IS NOT NULL AND "categoryId" IS NOT NULL AND cardinality("staffRoleIds") >= 1));
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ids_digits"
  CHECK ("channelId" ~ '^[0-9]{17,20}$' AND "openerId" ~ '^[0-9]{17,20}$'
     AND ("claimedById" IS NULL OR "claimedById" ~ '^[0-9]{17,20}$') AND ("closedById" IS NULL OR "closedById" ~ '^[0-9]{17,20}$'));
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_number_positive" CHECK ("number" >= 1);
