import "server-only";
import type { EventCalendarConfig, EventRule } from "@aboutselphy/db";
import { MAX_ARTICLE_CHARS, parseArticle } from "@aboutselphy/shared/eventcal-article";
import { MAX_EVENT_RULES, type EventRuleInput, type EventSettings } from "@aboutselphy/shared/eventcal";
import { errorInfo } from "@/lib/log";
import { checkEventCalendarViaBot, postEventMonthlyViaBot, repostEventViaBot, listChannels, listRoles, postEventOverviewViaBot, reloadBotModule } from "@/modules/bot-api";
import { countRules, createRule, deleteArticle, deleteRule, listArticles, listPostedEvents, saveArticle, findRule, listRules, readConfig, updateConfig, updateRule } from "./repository";
import type { ArticleRow, CheckEventsResult, PostedEventRow, RepostResult, ImportArticleResult, EventOverview, EventRuleRow, OverviewResult, SaveEventSettingsResult, SaveRuleResult, SimpleEventResult } from "./schema";

const toSettings = (c: EventCalendarConfig): EventSettings => ({ enabled: c.enabled, icsUrl: c.icsUrl, overviewChannelId: c.overviewChannelId ?? "", overviewDays: c.overviewDays, summaryChannelId: c.summaryChannelId ?? "" });
const toRow = (r: EventRule): EventRuleRow => ({ id: r.id, name: r.name, words: r.words, categories: r.categories, channelId: r.channelId, pingRoleId: r.pingRoleId ?? "", daysAhead: r.daysAhead, useAi: r.useAi, enabled: r.enabled });

/** Settings, the rules, and the channels and roles to pick from (null = bot unreachable). */
export async function getEventsPage() {
  const [config, rules, channels, roles, articleRows, postedRows] = await Promise.all([readConfig(), listRules(), listChannels(["text"]), listRoles(), listArticles(), listPostedEvents()]);
  const posted: PostedEventRow[] = postedRows.map((p) => ({ id: p.id, title: p.title || p.eventKey.split("|")[0] || "event", rule: p.rule.name, startsAt: p.startsAt.toISOString() }));
  const articles: ArticleRow[] = articleRows.map((a) => ({ id: a.id, title: a.title, monthKey: a.monthKey, events: parseArticle(a.text).length, createdAt: a.createdAt.toISOString() }));
  const overview: EventOverview = { settings: toSettings(config), hasOverview: config.overviewMessageId !== null, lastCheckedAt: config.lastCheckedAt?.toISOString() ?? null, lastStatus: config.lastStatus, baselined: config.baselined };
  return { overview, rules: rules.map(toRow), channels, roles, articles, posted };
}

export async function saveEventSettings(input: EventSettings): Promise<SaveEventSettingsResult> {
  try {
    const current = await readConfig();
    const newChannels = [input.overviewChannelId !== current.overviewChannelId ? input.overviewChannelId : "", input.summaryChannelId !== (current.summaryChannelId ?? "") ? input.summaryChannelId : ""].filter(Boolean);
    if (newChannels.length > 0) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (newChannels.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    // Another calendar address starts over: the first check of it only remembers what is there.
    const saved = await updateConfig({ enabled: input.enabled, icsUrl: input.icsUrl, overviewChannelId: input.overviewChannelId || null, overviewDays: input.overviewDays, summaryChannelId: input.summaryChannelId || null, ...(input.icsUrl !== current.icsUrl ? { baselined: false as const } : {}) });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("eventcal") };
  } catch (error) {
    console.error("[eventcal] saving the settings failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Adds (no id) or changes (with id) a rule. Its channel and role must exist (checked through the bot). */
export async function saveRule(input: EventRuleInput): Promise<SaveRuleResult> {
  try {
    const existing = input.id ? await findRule(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (!existing && (await countRules()) >= MAX_EVENT_RULES) return { ok: false, error: "tooMany" };
    const roleId = input.pingRoleId || null;
    if (!existing || existing.channelId !== input.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    if (roleId && roleId !== (existing?.pingRoleId ?? null)) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      if (!roles.some((r) => r.id === roleId)) return { ok: false, error: "roleNotFound" };
    }
    const data = { name: input.name, words: input.words, categories: input.categories, channelId: input.channelId, pingRoleId: roleId, daysAhead: input.daysAhead, useAi: input.useAi, enabled: input.enabled };
    if (existing) {
      const reseed = existing.channelId !== data.channelId || existing.words.join("\n") !== data.words.join("\n") || existing.categories.join("\n") !== data.categories.join("\n") || (!existing.enabled && data.enabled);
      await updateRule(existing.id, data, reseed);
    } else {
      await createRule(data);
    }
    return { ok: true, botNotified: await reloadBotModule("eventcal") };
  } catch (error) {
    console.error("[eventcal] saving a rule failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeRule(id: string): Promise<SimpleEventResult> {
  try {
    return (await deleteRule(id)) > 0 ? { ok: true } : { ok: false, error: "notFound" };
  } catch (error) {
    console.error("[eventcal] removing a rule failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Asks the bot to read the calendar now. */
export async function checkNow(): Promise<CheckEventsResult> {
  const result = await checkEventCalendarViaBot();
  return result ? { ok: true, ...result } : { ok: false, error: "botUnavailable" };
}

/** Asks the bot to post (or update) the overview message. */
export async function postOverview(): Promise<OverviewResult> {
  const status = await postEventOverviewViaBot();
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "posted" || status === "updated") return { ok: true, status };
  return { ok: false, error: status === "needsSetup" ? "needsSetup" : status === "channel" ? "channelNotFound" : "failed" };
}

/**
 * Saves a pasted monthly news article. Its sections add dates and details to the calendar's events (and events the calendar lacks). The text
 * is only ever parsed, never run; an article we can't read is refused so a wrong paste doesn't silently do nothing.
 */
export async function importArticle(text: string, byName: string): Promise<ImportArticleResult> {
  try {
    if (text.length > MAX_ARTICLE_CHARS) return { ok: false, error: "tooLong" };
    const events = parseArticle(text);
    const dated = events.filter((e) => e.start !== null);
    if (events.length === 0) return { ok: false, error: "unreadable" };
    const first = dated[0]?.start ?? new Date();
    const monthKey = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
    const title = (text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "Monthly article").slice(0, 200);
    await saveArticle({ monthKey, title, text, importedByName: byName.slice(0, 100) });
    await reloadBotModule("eventcal");
    return { ok: true, dated: dated.length, repeating: events.length - dated.length, month: monthKey };
  } catch (error) {
    console.error("[eventcal] importing an article failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeArticle(id: string): Promise<SimpleEventResult> {
  try {
    const gone = (await deleteArticle(id)) > 0;
    if (gone) await reloadBotModule("eventcal");
    return gone ? { ok: true } : { ok: false, error: "notFound" };
  } catch (error) {
    console.error("[eventcal] removing an article failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Asks the bot to post one already announced event again (the old message is deleted). */
export async function repostEvent(id: string): Promise<RepostResult> {
  const status = await repostEventViaBot(id);
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "done") return { ok: true };
  return { ok: false, error: status === "not-found" ? "notFound" : status === "gone" ? "gone" : status === "channel" ? "channelNotFound" : "failed" };
}

/** Asks the bot to post (or update) the detailed monthly summary. */
export async function postMonthlySummary(month: "current" | "next"): Promise<OverviewResult> {
  const status = await postEventMonthlyViaBot(month);
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "posted" || status === "updated") return { ok: true, status };
  return { ok: false, error: status === "needsSetup" ? "needsSetup" : status === "channel" ? "channelNotFound" : "failed" };
}
