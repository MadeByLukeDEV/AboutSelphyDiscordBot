"use server";

import { ticketSettingsSchema } from "@aboutselphy/shared/tickets";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { PanelResult, SaveTicketsResult } from "./schema";
import { publishPanel, saveTickets } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (ticket settings are admin-only), validates its input, and returns codes (never error text).

async function isAdminSession(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

async function saveTicketSettingsActionRun(input: unknown): Promise<SaveTicketsResult> {
  if (!(await isAdminSession())) return { ok: false, error: "forbidden" };
  const parsed = ticketSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message);
    const known = (["needsPanelChannel", "needsCategory", "needsStaff"] as const).find((m) => messages.includes(m));
    return { ok: false, error: known ?? "invalid" };
  }
  return saveTickets(parsed.data);
}

async function postPanelActionRun(): Promise<PanelResult> {
  if (!(await isAdminSession())) return { ok: false, error: "forbidden" };
  return publishPanel();
}

export async function saveTicketSettingsAction(...args: Parameters<typeof saveTicketSettingsActionRun>): ReturnType<typeof saveTicketSettingsActionRun> {
  return audited("tickets.saveTicketSettings", saveTicketSettingsActionRun, args);
}

export async function postPanelAction(...args: Parameters<typeof postPanelActionRun>): ReturnType<typeof postPanelActionRun> {
  return audited("tickets.postPanel", postPanelActionRun, args);
}
