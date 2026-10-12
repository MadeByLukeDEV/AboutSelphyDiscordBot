import type { GiveawayStatus } from "@aboutselphy/db";

// Types shared by the service, the actions and the client components. No server-only imports.

export type GiveawayView = {
  id: string;
  status: GiveawayStatus;
  channelId: string;
  prize: string;
  description: string;
  imageUrl: string;
  winnerCount: number;
  endsAt: string;
  requiredRoleId: string;
  pingRoleId: string;
  bonusRoleId: string;
  bonusEntries: number;
  hostName: string;
  winners: string[];
  entryCount: number;
};

export type GiveawayError =
  | "forbidden"
  | "invalid"
  | "notFound"
  | "wrongState"
  | "botUnavailable"
  | "channelNotFound"
  | "roleNotFound"
  | "failed";

/** `startError`: the giveaway was saved but could not be posted (it stays a draft). */
export type SaveGiveawayResult = { ok: true; giveaway: GiveawayView; started: boolean; startError: GiveawayError | null } | { ok: false; error: GiveawayError };
export type GiveawayActionResult = { ok: true } | { ok: false; error: GiveawayError };
