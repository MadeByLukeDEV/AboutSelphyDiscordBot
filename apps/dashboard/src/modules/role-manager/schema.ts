import type { ManagedRole } from "@aboutselphy/shared";

// Types shared by the service, the actions and the client components. No server-only imports.

export const USAGE_KEYS = ["panel", "levelReward", "welcome", "noXp", "tickets", "giveaway", "announcement", "twitch", "youtube", "birthday"] as const;
export type UsageKey = (typeof USAGE_KEYS)[number];

export type RoleRow = ManagedRole & { usedBy: UsageKey[] };

export type RoleManagerError = "forbidden" | "invalid" | "botUnavailable" | "failed";
export type DeleteRolesResult = { ok: true; deleted: string[]; skipped: Array<{ id: string; status: "not-found" | "protected" | "failed" }> } | { ok: false; error: RoleManagerError };

export type RoleToolError = "forbidden" | "invalid" | "botUnavailable" | "notFound" | "protected" | "targetInvalid" | "sourceInvalid" | "edge" | "sourcePowerful" | "same" | "failed";
export type UpdateRoleResult = { ok: true } | { ok: false; error: RoleToolError };
export type MergeRolesResult = { ok: true; added: number; alreadyHad: number; failed: number; deleted: string[] } | { ok: false; error: RoleToolError };

/** Settings that still point at roles that no longer exist in the server. */
export type Dangling = { key: UsageKey; count: number }[];
export type CleanupResult = { ok: true; removed: Partial<Record<UsageKey, number>> } | { ok: false; error: RoleToolError };
