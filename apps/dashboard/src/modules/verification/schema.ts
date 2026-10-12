import type { VerificationSettings } from "@aboutselphy/shared/entry";

// Types shared by the service, the actions and the client components. No server-only imports.

export type VerificationError = "forbidden" | "invalid" | "needsChannel" | "needsRole" | "botUnavailable" | "channelNotFound" | "roleNotFound" | "roleNotUsable" | "failed";
export type SaveVerificationResult = { ok: true; settings: VerificationSettings; botNotified: boolean } | { ok: false; error: VerificationError };

export type PanelError = "forbidden" | "needsSetup" | "botUnavailable" | "channel" | "failed";
export type PostPanelResult = { ok: true; status: "posted" | "updated" } | { ok: false; error: PanelError };
