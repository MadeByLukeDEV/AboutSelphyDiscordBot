ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT "WebhookEndpoint_provider_valid";
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_provider_valid" CHECK ("provider" IN ('generic', 'github', 'kofi', 'stripe'));
