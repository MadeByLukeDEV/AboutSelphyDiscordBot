// Types shared by the service, the actions and the client components. No server-only imports.

export type StickyRow = { id: string; channelId: string; content: string; enabled: boolean };
export type StickyError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "alreadyAdded" | "tooMany" | "notFound" | "failed";
export type StickyResult = { ok: true; botNotified: boolean } | { ok: false; error: StickyError };
