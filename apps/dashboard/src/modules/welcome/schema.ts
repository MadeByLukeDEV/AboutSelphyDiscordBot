import type { WelcomeSettings } from "@aboutselphy/shared/welcome";

// Types shared by the service, the action and the client form. No server-only imports.

export type WelcomeError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "roleNotAllowed" | "failed";

export type SaveWelcomeResult = { ok: true; settings: WelcomeSettings; botNotified: boolean } | { ok: false; error: WelcomeError };
