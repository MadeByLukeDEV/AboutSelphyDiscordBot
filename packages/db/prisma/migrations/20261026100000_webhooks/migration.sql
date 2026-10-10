-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "channelId" VARCHAR(20) NOT NULL,
    "secretEnc" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundWebhook" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kind" VARCHAR(10) NOT NULL,
    "urlEnc" TEXT NOT NULL,
    "secretEnc" TEXT,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastStatus" VARCHAR(24),
    "lastAt" TIMESTAMP(3),
    "createdByName" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundWebhook_pkey" PRIMARY KEY ("id")
);

-- Hand-written CHECK constraints (Prisma can't express them).
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_channel_digits" CHECK ("channelId" ~ '^[0-9]{17,20}$');
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_name_not_empty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_uses_positive" CHECK ("uses" >= 0);
ALTER TABLE "OutboundWebhook" ADD CONSTRAINT "OutboundWebhook_kind" CHECK ("kind" IN ('discord', 'generic'));
ALTER TABLE "OutboundWebhook" ADD CONSTRAINT "OutboundWebhook_name_not_empty" CHECK (length(btrim("name")) > 0);
ALTER TABLE "OutboundWebhook" ADD CONSTRAINT "OutboundWebhook_events_count" CHECK (cardinality("events") BETWEEN 1 AND 10);
ALTER TABLE "OutboundWebhook" ADD CONSTRAINT "OutboundWebhook_generic_has_secret" CHECK ("kind" <> 'generic' OR "secretEnc" IS NOT NULL);
