"use server";

import { z } from "zod";
import { eventCheckBody, eventMonthlyBody, eventOverviewBody, eventRuleSchema, eventSourceSchema, gameEventSchema } from "@aboutselphy/shared/eventcal";
import { MAX_ARTICLE_CHARS } from "@aboutselphy/shared/eventcal-article";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { audited } from "@/modules/audit";
import type { CheckEventsResult, ImportArticleResult, OverviewResult, RepostResult, SaveRuleResult, SaveSourceResult, SimpleEventResult } from "./schema";
import { bringBackEvent, checkNow, importArticle, postMonthlySummary, postOverview, removeArticle, removeEvent, removeRule, removeSource, repostEvent, saveEvent, saveRule, saveSource } from "./service";

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

const idBody = z.object({ id: z.string().min(1).max(64) });

async function saveEventRuleActionRun(input: unknown): Promise<SaveRuleResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = eventRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveRule(parsed.data);
}

async function deleteEventRuleActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = idBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeRule(parsed.data.id);
}

async function postEventOverviewActionRun(input: unknown): Promise<OverviewResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = eventOverviewBody.safeParse(input ?? {});
  if (!parsed.success || !parsed.data.sourceId) return { ok: false, error: "invalid" };
  return postOverview(parsed.data.sourceId);
}

async function postEventMonthlyActionRun(input: unknown): Promise<OverviewResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = eventMonthlyBody.safeParse(input);
  if (!parsed.success || !parsed.data.sourceId) return { ok: false, error: "invalid" };
  return postMonthlySummary(parsed.data.month, parsed.data.sourceId);
}

async function saveEventSourceActionRun(input: unknown): Promise<SaveSourceResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = eventSourceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveSource(parsed.data);
}

async function deleteEventSourceActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = idBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeSource(parsed.data.id);
}

async function importEventArticleActionRun(input: unknown): Promise<ImportArticleResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = z.object({ text: z.string().min(1).max(MAX_ARTICLE_CHARS), sourceId: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return importArticle(parsed.data.text, session.user.name, parsed.data.sourceId);
}

async function deleteEventArticleActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = idBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeArticle(parsed.data.id);
}

async function repostEventActionRun(input: unknown): Promise<RepostResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = idBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return repostEvent(parsed.data.id);
}

async function saveGameEventActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = gameEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveEvent(parsed.data);
}

async function removeGameEventActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = idBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeEvent(parsed.data.id);
}

async function restoreGameEventActionRun(input: unknown): Promise<SimpleEventResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = idBody.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return bringBackEvent(parsed.data.id);
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

export async function postEventMonthlyAction(...args: Parameters<typeof postEventMonthlyActionRun>): ReturnType<typeof postEventMonthlyActionRun> {
  return audited("eventcal.postEventMonthly", postEventMonthlyActionRun, args);
}

export async function saveEventSourceAction(...args: Parameters<typeof saveEventSourceActionRun>): ReturnType<typeof saveEventSourceActionRun> {
  return audited("eventcal.saveEventSource", saveEventSourceActionRun, args);
}

export async function deleteEventSourceAction(...args: Parameters<typeof deleteEventSourceActionRun>): ReturnType<typeof deleteEventSourceActionRun> {
  return audited("eventcal.deleteEventSource", deleteEventSourceActionRun, args);
}

export async function importEventArticleAction(...args: Parameters<typeof importEventArticleActionRun>): ReturnType<typeof importEventArticleActionRun> {
  return audited("eventcal.importEventArticle", importEventArticleActionRun, args);
}

export async function deleteEventArticleAction(...args: Parameters<typeof deleteEventArticleActionRun>): ReturnType<typeof deleteEventArticleActionRun> {
  return audited("eventcal.deleteEventArticle", deleteEventArticleActionRun, args);
}

export async function repostEventAction(...args: Parameters<typeof repostEventActionRun>): ReturnType<typeof repostEventActionRun> {
  return audited("eventcal.repostEvent", repostEventActionRun, args);
}

export async function saveGameEventAction(...args: Parameters<typeof saveGameEventActionRun>): ReturnType<typeof saveGameEventActionRun> {
  return audited("eventcal.saveGameEvent", saveGameEventActionRun, args);
}

export async function removeGameEventAction(...args: Parameters<typeof removeGameEventActionRun>): ReturnType<typeof removeGameEventActionRun> {
  return audited("eventcal.removeGameEvent", removeGameEventActionRun, args);
}

export async function restoreGameEventAction(...args: Parameters<typeof restoreGameEventActionRun>): ReturnType<typeof restoreGameEventActionRun> {
  return audited("eventcal.restoreGameEvent", restoreGameEventActionRun, args);
}

/** Reading the sources changes nothing but posts the events that are due, so it is a plain admin-only call (not logged in the audit trail). */
export async function checkEventCalendarAction(input: unknown = {}): Promise<CheckEventsResult> {
  if (!(await adminOnly())) return { ok: false, error: "forbidden" };
  const parsed = eventCheckBody.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: "invalid" };
  return checkNow(parsed.data.sourceId);
}
