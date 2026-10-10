-- CreateTable
CREATE TABLE "BirthdayConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(20),
    "roleId" VARCHAR(20),
    "message" VARCHAR(300) NOT NULL DEFAULT '🎂 Happy birthday {user}!',
    "timeZone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BirthdayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Birthday" (
    "userId" VARCHAR(20) NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "lastCelebratedOn" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Birthday_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Birthday_month_day_idx" ON "Birthday"("month", "day");

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "BirthdayConfig" ADD CONSTRAINT "BirthdayConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "BirthdayConfig" ADD CONSTRAINT "BirthdayConfig_ids_digits"
  CHECK (("channelId" IS NULL OR "channelId" ~ '^[0-9]{17,20}$') AND ("roleId" IS NULL OR "roleId" ~ '^[0-9]{17,20}$'));
ALTER TABLE "BirthdayConfig" ADD CONSTRAINT "BirthdayConfig_enabled_has_target" CHECK (NOT "enabled" OR "channelId" IS NOT NULL OR "roleId" IS NOT NULL);
ALTER TABLE "BirthdayConfig" ADD CONSTRAINT "BirthdayConfig_message_not_empty" CHECK (length(btrim("message")) > 0);
ALTER TABLE "Birthday" ADD CONSTRAINT "Birthday_user_digits" CHECK ("userId" ~ '^[0-9]{17,20}$');
ALTER TABLE "Birthday" ADD CONSTRAINT "Birthday_date_range" CHECK ("month" BETWEEN 1 AND 12 AND "day" BETWEEN 1 AND 31);
ALTER TABLE "Birthday" ADD CONSTRAINT "Birthday_celebrated_format" CHECK ("lastCelebratedOn" IS NULL OR "lastCelebratedOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
