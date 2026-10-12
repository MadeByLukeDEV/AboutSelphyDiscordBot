import type { VipSettings, VipStatus } from "@aboutselphy/shared/twitchvip";

// Types shared by the service, the actions and the client components. No server-only imports.

export type VipError = "forbidden" | "invalid" | "needsRole" | "botUnavailable" | "roleNotFound" | "roleNotUsable" | "notFound" | "alreadyApproved" | "failed";
export type SaveVipResult = { ok: true; settings: VipSettings; botNotified: boolean } | { ok: false; error: VipError };
export type VipLinkResult = { ok: true } | { ok: false; error: VipError };

export type VipLinkRow = {
  id: string;
  discordUserId: string;
  discordName: string;
  twitchLogin: string;
  approved: boolean;
  approvedByName: string | null;
  createdAt: string;
};

export type VipState = { status: VipStatus; vipCount: number; lastSyncAt: string | null };
