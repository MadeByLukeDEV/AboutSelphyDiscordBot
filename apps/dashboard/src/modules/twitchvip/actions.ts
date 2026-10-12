"use server";

import { vipSettingsSchema } from "@aboutselphy/shared/twitchvip";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { StaffSession } from "@/modules/auth";
import type { SaveVipResult, VipLinkResult } from "./schema";
import { approveVipLink, removeVipLink, saveVipSettings } from "./service";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function admin(): Promise<StaffSession | null> {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

export async function saveVipSettingsAction(input: unknown): Promise<SaveVipResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  const parsed = vipSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.path[0] === "roleId") ? "needsRole" : "invalid" };
  return saveVipSettings(parsed.data);
}

export async function approveVipLinkAction(id: unknown): Promise<VipLinkResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return approveVipLink(id, session.user.name);
}

export async function removeVipLinkAction(id: unknown): Promise<VipLinkResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeVipLink(id);
}
