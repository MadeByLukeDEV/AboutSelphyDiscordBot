-- CreateTable
CREATE TABLE "RetentionConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "ticketTranscriptDays" INTEGER NOT NULL DEFAULT 0,
    "caseDays" INTEGER NOT NULL DEFAULT 0,
    "suggestionDays" INTEGER NOT NULL DEFAULT 0,
    "inactiveXpDays" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "lastResult" VARCHAR(300) NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionConfig_pkey" PRIMARY KEY ("id")
);

-- Singleton, and every limit between "keep" (0) and ten years.
ALTER TABLE "RetentionConfig" ADD CONSTRAINT "RetentionConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "RetentionConfig" ADD CONSTRAINT "RetentionConfig_days_range" CHECK (
  "ticketTranscriptDays" BETWEEN 0 AND 3650 AND "caseDays" BETWEEN 0 AND 3650 AND "suggestionDays" BETWEEN 0 AND 3650 AND "inactiveXpDays" BETWEEN 0 AND 3650
);
