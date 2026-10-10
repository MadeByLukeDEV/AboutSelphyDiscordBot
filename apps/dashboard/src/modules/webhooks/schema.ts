import type { OutboundEvent } from "@aboutselphy/shared/webhooks";

// Types shared by the service, the actions and the client components. No server-only imports.
// Secrets and full addresses never appear here: a secret is shown once, when it is made.

export type EndpointRow = { id: string; name: string; channelId: string; enabled: boolean; uses: number; lastUsedAt: string | null; url: string };
export type OutboundRow = { id: string; name: string; kind: "discord" | "generic"; events: OutboundEvent[]; enabled: boolean; host: string; lastStatus: string | null; lastAt: string | null };

export type WebhooksError = "forbidden" | "invalid" | "notReady" | "botUnavailable" | "channelNotFound" | "tooMany" | "notFound" | "failed";
/** `secret` is set only when a secret was just made; the dashboard shows it once and can't show it again. */
export type SaveEndpointResult = { ok: true; id: string; url: string; secret: string | null } | { ok: false; error: WebhooksError };
export type SaveOutboundResult = { ok: true; secret: string | null } | { ok: false; error: WebhooksError };
export type SimpleWebhookResult = { ok: true } | { ok: false; error: WebhooksError };
export type TestWebhookResult = { ok: true } | { ok: false; error: WebhooksError | "deliveryFailed" };
