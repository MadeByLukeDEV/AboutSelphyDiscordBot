-- CreateTable
CREATE TABLE "ReminderConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxPerUser" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReminderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "userId" VARCHAR(20) NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "message" VARCHAR(500) NOT NULL,
    "remindAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reminder_deliveredAt_remindAt_idx" ON "Reminder"("deliveredAt", "remindAt");

-- CreateIndex
CREATE INDEX "Reminder_userId_deliveredAt_idx" ON "Reminder"("userId", "deliveredAt");

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "ReminderConfig" ADD CONSTRAINT "ReminderConfig_singleton" CHECK ("id" = 1);
ALTER TABLE "ReminderConfig" ADD CONSTRAINT "ReminderConfig_max_range" CHECK ("maxPerUser" BETWEEN 1 AND 50);
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_ids_digits" CHECK ("userId" ~ '^[0-9]{17,20}$' AND "channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_message_not_empty" CHECK (length(btrim("message")) > 0);
