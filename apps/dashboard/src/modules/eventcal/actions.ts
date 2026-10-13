"use server";

import { z } from "zod";
import { eventRuleSchema, eventSettingsSchema } from "@aboutselphy/shared/eventcal";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { CheckEventsResult, ImportArticleResult, OverviewResult, RepostResult, SaveEventSettingsResult, SaveRuleResult, SimpleEventResult } from "./schema";
import { MAX_ARTICLE_CHARS } from "@aboutselphy/shared/eventcal-article";
import { checkNow, importArticle, repostEvent, postOverview, removeArticle, removeRule, saveEventSettings, saveRule } from "./service";
import { audited } from "@/modules/audit";

// Public POST endpoints like every Server Action: each one checks the session and the role itself (admins only), validates its input, and returns codes.

async function adminOnly(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

async function saveEventSettingsActionRun(input: unknown): Promise<SaveEventSettingsResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = eventSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveEventSettings(parsed.data);
}

async function saveEventRuleActionRun(input: unknown): Promise<SaveRuleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = eventRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveRule(parsed.data);
}

async function deleteEventRuleActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeRule(parsed.data.id);
}

async function postEventOverviewActionRun(): Promise<OverviewResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return postOverview();
}

export async function saveEventSettingsAction(...args: Parameters<typeof saveEventSettingsActionRun>): ReturnType<typeof saveEventSettingsActionRun> {
  return audited("eventcal.saveEventSettings", saveEventSettingsActionRun, args);
}

export async function saveEventRuleAction(...args: Parameters<typeof saveEventRuleActionRun>): ReturnType<typeof saveEventRuleActionRun> {
  return audited("eventcal.saveEventRule", saveEventRuleActionRun, args);
}

export async function deleteEventRuleAction(...args: Parameters<typeof deleteEventRuleActionRun>): ReturnType<typeof deleteEventRuleActionRun> {
  return audited("eventcal.deleteEventRule", deleteEventRuleActionRun, args);
}

export async function postEventOverviewAction(...args: Parameters<typeof postEventOverviewActionRun>): ReturnType<typeof postEventOverviewActionRun> {
  return audited("eventcal.postEventOverview", postEventOverviewActionRun, args);
}

/** Reading the calendar changes nothing but posts the new events, so it is a plain admin-only call (not logged in the audit trail). */
export async function checkEventCalendarAction(): Promise<CheckEventsResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  return checkNow();
}

async function importEventArticleActionRun(input: unknown): Promise<ImportArticleResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = z.object({ text: z.string().min(1).max(MAX_ARTICLE_CHARS) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return importArticle(parsed.data.text, session.user.name);
}

async function deleteEventArticleActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeArticle(parsed.data.id);
}

export async function importEventArticleAction(...args: Parameters<typeof importEventArticleActionRun>): ReturnType<typeof importEventArticleActionRun> {
  return audited("eventcal.importEventArticle", importEventArticleActionRun, args);
}

export async function deleteEventArticleAction(...args: Parameters<typeof deleteEventArticleActionRun>): ReturnType<typeof deleteEventArticleActionRun> {
  return audited("eventcal.deleteEventArticle", deleteEventArticleActionRun, args);
}

async function repostEventActionRun(input: unknown): Promise<RepostResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return repostEvent(parsed.data.id);
}

export async function repostEventAction(...args: Parameters<typeof repostEventActionRun>): ReturnType<typeof repostEventActionRun> {
  return audited("eventcal.repostEvent", repostEventActionRun, args);
}
