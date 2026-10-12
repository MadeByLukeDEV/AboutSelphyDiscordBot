-- AlterTable
ALTER TABLE "WebhookEndpoint" ADD COLUMN "provider" VARCHAR(8) NOT NULL DEFAULT 'generic';
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_provider_valid" CHECK ("provider" IN ('generic', 'github', 'kofi'));

ALTER TABLE "OutboundWebhook" ADD COLUMN "failStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OutboundWebhook" ADD COLUMN "autoDisabledAt" TIMESTAMP(3);
ALTER TABLE "OutboundWebhook" ADD CONSTRAINT "OutboundWebhook_failStreak_nonneg" CHECK ("failStreak" >= 0);
