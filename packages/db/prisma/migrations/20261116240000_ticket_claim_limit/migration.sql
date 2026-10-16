ALTER TABLE "TicketConfig" ADD COLUMN "maxClaimsPerStaff" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TicketConfig" ADD CONSTRAINT "TicketConfig_maxClaimsPerStaff_check" CHECK ("maxClaimsPerStaff" >= 0 AND "maxClaimsPerStaff" <= 50);
