import type { StatKind } from "@aboutselphy/shared/stat-channels";

// Types shared by the service, the actions and the client components. No server-only imports.

export type StatChannelRow = { id: string; channelId: string; kind: StatKind; template: string; lastName: string | null };

export type StatChannelError = "forbidden" | "invalid" | "needsCount" | "botUnavailable" | "channelNotFound" | "alreadyAdded" | "tooMany" | "notFound" | "failed";
export type SaveStatChannelResult = { ok: true; botNotified: boolean } | { ok: false; error: StatChannelError };
