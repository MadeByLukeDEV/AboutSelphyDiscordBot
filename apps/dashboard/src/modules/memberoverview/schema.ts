import type { MemberOverviewInput } from "@aboutselphy/shared/memberoverview";

// Types shared by the service, the actions and the client components. No server-only imports.

export type MemberOverviewError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "channelNotUsable" | "failed";
export type SaveMemberOverviewResult = { ok: true; settings: MemberOverviewInput } | { ok: false; error: MemberOverviewError };
export type PostMemberOverviewResult = { ok: true; messages: number } | { ok: false; error: MemberOverviewError };
export type MemberOverviewPageData = { settings: MemberOverviewInput; /** When it was last posted, as ISO text (null: never). */ postedAt: string | null };
