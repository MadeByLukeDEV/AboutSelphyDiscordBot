"use server";

import { AuthorizationError, requireAdmin, requireStaff } from "@/modules/auth";
import { caseNumberSchema, memberActionSchema, reasonSchema, settingsSchema, type ActResult, type EditReasonResult, type PardonResult, type SaveSettingsResult } from "./schema";
import { actOnMember, editCaseReason, pardon, saveSettings } from "./service";
import { audited } from "@/modules/audit";

// Server Actions are public POST endpoints: each one checks the session and the
// role itself and validates its input, whatever the UI shows. They return codes,
// never error text, and the client maps codes to translated messages.

/** Admins only: where cases are posted and whether members get DMs. */
async function saveSettingsActionRun(input: unknown): Promise<SaveSettingsResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveSettings(parsed.data);
}

/** Any staff member: pardon an active warning (kept in the history, marked pardoned). */
async function pardonWarningActionRun(caseNumber: unknown): Promise<PardonResult> {
  let session;
  try {
    session = await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = caseNumberSchema.safeParse(caseNumber);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return pardon(parsed.data, session.user);
}

/** Any staff member: warn, time out, kick, ban, unban or note a member from the dashboard (the bot does it and the case names the staff member). */
async function actOnMemberActionRun(input: unknown): Promise<ActResult> {
  let session;
  try {
    session = await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = memberActionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return actOnMember(parsed.data, session.user);
}

/** Any staff member: correct the reason of a case. */
async function editCaseReasonActionRun(caseNumber: unknown, reason: unknown): Promise<EditReasonResult> {
  let session;
  try {
    session = await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const number = caseNumberSchema.safeParse(caseNumber);
  const text = reasonSchema.safeParse(reason);
  if (!number.success || !text.success) return { ok: false, error: "invalid" };
  return editCaseReason(number.data, text.data, session.user);
}

export async function saveSettingsAction(...args: Parameters<typeof saveSettingsActionRun>): ReturnType<typeof saveSettingsActionRun> {
  return audited("moderation.saveSettings", saveSettingsActionRun, args);
}

export async function pardonWarningAction(...args: Parameters<typeof pardonWarningActionRun>): ReturnType<typeof pardonWarningActionRun> {
  return audited("moderation.pardonWarning", pardonWarningActionRun, args);
}

export async function actOnMemberAction(...args: Parameters<typeof actOnMemberActionRun>): ReturnType<typeof actOnMemberActionRun> {
  return audited("moderation.actOnMember", actOnMemberActionRun, args);
}

export async function editCaseReasonAction(...args: Parameters<typeof editCaseReasonActionRun>): ReturnType<typeof editCaseReasonActionRun> {
  return audited("moderation.editCaseReason", editCaseReasonActionRun, args);
}
