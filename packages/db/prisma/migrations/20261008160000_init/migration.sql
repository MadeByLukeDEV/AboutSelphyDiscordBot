-- No CREATE SCHEMA here on purpose: aboutselphy_bot owns the "bot" schema but has
-- no database-level CREATE right, and Postgres checks that right even for
-- IF NOT EXISTS. The schema is created once by the superuser (see CLAUDE.md).

-- CreateTable
CREATE TABLE "BotSetting" (
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSetting_pkey" PRIMARY KEY ("key")
);
