import "server-only";
import { randomUUID } from "node:crypto";
import type { EventRule } from "@aboutselphy/db";
import { MAX_ARTICLE_CHARS, parseArticle } from "@aboutselphy/shared/eventcal-article";
import { cardImageProblem, readImageInfo } from "@aboutselphy/shared/image-info";
import { MAX_EVENT_RULES, MAX_EVENT_SOURCES, type EventRuleInput, type EventSourceInput, type GameEventInput } from "@aboutselphy/shared/eventcal";
import { errorInfo } from "@/lib/log";
import { getEventPreviewCard, checkEventCalendarViaBot, postEventMonthlyViaBot, repostEventViaBot, listChannels, listRoles, postEventOverviewViaBot, reloadBotModule } from "@/modules/bot-api";
import type { PictureData } from "./repository";
import { clearItemImage, deleteBackground, deleteItem, ensureItems, findItem, listBackgrounds, listItems, readBackground, readItemImage, saveBackground, setItemImage, countRules, countSources, createManualEvent, createRule, createSource, deleteArticle, deleteEvent, deleteRule, deleteSource, findEvent, findRule, findSource, hideEvent, listArticles, listEvents, listPostedEvents, listRules, listSources, restoreEvent, saveArticle, updateEvent, updateRule, updateSource } from "./repository";
import type { ImageResult, ItemRow, ArticleRow, CheckEventsResult, EventRow, EventRuleRow, ImportArticleResult, OverviewResult, PostedEventRow, RepostResult, SaveRuleResult, SaveSourceResult, SimpleEventResult, SourceRow } from "./schema";

const toRow = (r: EventRule): EventRuleRow => ({ id: r.id, name: r.name, words: r.words, categories: r.categories, kinds: r.kinds as EventRuleRow["kinds"], channelId: r.channelId, pingRoleId: r.pingRoleId ?? "", leadDays: r.leadDays, useCard: r.useCard, postSeries: r.postSeries, useAi: r.useAi, sourceId: r.sourceId ?? "", enabled: r.enabled });

type SourceModel = Awaited<ReturnType<typeof listSources>>[number];
type EventModel = Awaited<ReturnType<typeof listEvents>>[number];

const toEventRow = (e: EventModel): EventRow => ({ id: e.id, title: e.title, kind: e.kind, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt?.toISOString() ?? null, allDay: e.allDay, description: e.description, summary: e.summary, items: e.items, imageUrl: e.imageUrl ?? "", videoUrl: e.videoUrl ?? "", origin: e.origin, locked: e.locked, removed: e.removedAt !== null, reminderDays: e.reminderDays, recurrence: e.recurrence });

const toSourceRow = (s: SourceModel, articles: ArticleRow[], events: EventRow[], items: ItemRow[], hasBackground: boolean): SourceRow => ({
  id: s.id,
  name: s.name,
  enabled: s.enabled,
  icsUrl: s.icsUrl ?? "",
  pageUrlTemplate: s.pageUrlTemplate ?? "",
  contentSelector: s.contentSelector ?? "",
  fetchMode: s.fetchMode,
  overviewChannelId: s.overviewChannelId ?? "",
  overviewDays: s.overviewDays,
  summaryChannelId: s.summaryChannelId ?? "",
  summaryAuto: s.summaryAuto,
  accentColor: s.accentColor,
  summaryImage: s.summaryImage,
  hasBackground,
  items,
  hasOverview: s.overviewMessageId !== null,
  lastCheckedAt: s.lastCheckedAt?.toISOString() ?? null,
  lastStatus: s.lastStatus,
  lastFetchedAt: s.lastFetchedAt?.toISOString() ?? null,
  lastFetchStatus: s.lastFetchStatus,
  // A flag older than five minutes is a crashed read, not a running one.
  syncing: s.syncStartedAt !== null && Date.now() - s.syncStartedAt.getTime() < 5 * 60_000,
  articles,
  events,
});

/** The sources with their articles and events, the rules, and the channels and roles to pick from (null = bot unreachable). */
export async function getEventsPage() {
  const [sourceRows, rules, channels, roles, articleRows, postedRows, eventRows, itemRows, backgroundRows] = await Promise.all([listSources(), listRules(), listChannels(["text"]), listRoles(), listArticles(), listPostedEvents(), listEvents(), listItems(), listBackgrounds()]);
  const posted: PostedEventRow[] = postedRows.map((p) => ({ id: p.id, title: p.title || p.eventKey.split("|")[0] || "event", rule: p.rule.name, startsAt: p.startsAt.toISOString() }));
  const sources: SourceRow[] = sourceRows.map((s) =>
    toSourceRow(
      s,
      articleRows.filter((a) => a.sourceId === s.id).map((a): ArticleRow => ({ id: a.id, title: a.title, monthKey: a.monthKey, events: parseArticle(a.text).length, createdAt: a.createdAt.toISOString() })),
      eventRows.filter((e) => e.sourceId === s.id).slice(0, 80).map(toEventRow),
      itemRows.filter((i) => i.sourceId === s.id).map((i): ItemRow => ({ id: i.id, name: i.name, hasImage: i.imageType !== null })),
      backgroundRows.some((b) => b.sourceId === s.id),
    ),
  );
  return { sources, rules: rules.map(toRow), channels, roles, posted };
}

/** Adds (no id) or changes (with id) a source. Its channels must exist (checked through the bot). */
export async function saveSource(input: EventSourceInput): Promise<SaveSourceResult> {
  try {
    const existing = input.id ? await findSource(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (!existing && (await countSources()) >= MAX_EVENT_SOURCES) return { ok: false, error: "tooMany" };
    const newChannels = [input.overviewChannelId !== (existing?.overviewChannelId ?? "") ? input.overviewChannelId : "", input.summaryChannelId !== (existing?.summaryChannelId ?? "") ? input.summaryChannelId : ""].filter(Boolean);
    if (newChannels.length > 0) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (newChannels.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    const data = {
      name: input.name,
      enabled: input.enabled,
      icsUrl: input.icsUrl || null,
      pageUrlTemplate: input.pageUrlTemplate || null,
      contentSelector: input.contentSelector || null,
      fetchMode: input.fetchMode,
      overviewChannelId: input.overviewChannelId || null,
      overviewDays: input.overviewDays,
      summaryChannelId: input.summaryChannelId || null,
      summaryAuto: input.summaryAuto,
      accentColor: input.accentColor.toLowerCase(),
      summaryImage: input.summaryImage,
    };
    if (existing) {
      // Another calendar or page address starts over: the first check of it only remembers what is there.
      const changed = (existing.icsUrl ?? "") !== (data.icsUrl ?? "") || (existing.pageUrlTemplate ?? "") !== (data.pageUrlTemplate ?? "");
      await updateSource(existing.id, { ...data, ...(changed ? { baselined: false as const } : {}) });
    } else {
      await createSource(data);
    }
    return { ok: true, botNotified: await reloadBotModule("eventcal") };
  } catch (error) {
    console.error("[eventcal] saving a source failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Removes a source with its rules, events, posted-event records and articles (the messages already in Discord stay). */
export async function removeSource(id: string): Promise<SimpleEventResult> {
  try {
    const gone = (await deleteSource(id)) > 0;
    if (gone) await reloadBotModule("eventcal");
    return gone ? { ok: true } : { ok: false, error: "notFound" };
  } catch (error) {
    console.error("[eventcal] removing a source failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Adds (no id) or changes (with id) a rule. Its source, channel and role must exist (channel and role are checked through the bot). */
export async function saveRule(input: EventRuleInput): Promise<SaveRuleResult> {
  try {
    const existing = input.id ? await findRule(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (!existing && (await countRules()) >= MAX_EVENT_RULES) return { ok: false, error: "tooMany" };
    if (!(await findSource(input.sourceId))) return { ok: false, error: "notFound" };
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
    const data = { name: input.name, words: input.words, categories: input.categories, kinds: input.kinds, channelId: input.channelId, pingRoleId: roleId, daysAhead: input.leadDays[0] ?? 7, leadDays: input.leadDays, useCard: input.useCard, postSeries: input.postSeries, useAi: input.useAi, enabled: input.enabled, sourceId: input.sourceId };
    if (existing) {
      const reseed = existing.channelId !== data.channelId || existing.words.join("\n") !== data.words.join("\n") || existing.categories.join("\n") !== data.categories.join("\n") || existing.kinds.join("\n") !== data.kinds.join("\n") || existing.leadDays.join(",") !== data.leadDays.join(",") || (!existing.useCard && data.useCard) || existing.sourceId !== data.sourceId || (!existing.enabled && data.enabled);
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

/** Asks the bot to read the sources now (all, or one) and post what is due. */
export async function checkNow(sourceId = ""): Promise<CheckEventsResult> {
  const result = await checkEventCalendarViaBot(sourceId);
  return result ? { ok: true, ...result } : { ok: false, error: "botUnavailable" };
}

/** Asks the bot to post (or update) a source's overview message. */
export async function postOverview(sourceId: string): Promise<OverviewResult> {
  const status = await postEventOverviewViaBot(sourceId);
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "posted" || status === "updated") return { ok: true, status };
  return { ok: false, error: status === "needsSetup" ? "needsSetup" : status === "channel" ? "channelNotFound" : "failed" };
}

/** Asks the bot to post (or update) a source's detailed monthly summary. */
export async function postMonthlySummary(month: "current" | "next", sourceId: string): Promise<OverviewResult> {
  const status = await postEventMonthlyViaBot(month, sourceId);
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "posted" || status === "updated") return { ok: true, status };
  return { ok: false, error: status === "needsSetup" ? "needsSetup" : status === "channel" ? "channelNotFound" : "failed" };
}

/**
 * Saves a pasted article for a source: the fallback when its page can't be fetched. The text is only ever parsed, never run; an article we can't
 * read is refused so a wrong paste doesn't silently do nothing.
 */
export async function importArticle(text: string, byName: string, sourceId: string): Promise<ImportArticleResult> {
  try {
    if (!(await findSource(sourceId))) return { ok: false, error: "notFound" };
    if (text.length > MAX_ARTICLE_CHARS) return { ok: false, error: "tooLong" };
    const events = parseArticle(text);
    const dated = events.filter((e) => e.start !== null);
    if (events.length === 0) return { ok: false, error: "unreadable" };
    const first = dated[0]?.start ?? new Date();
    const monthKey = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
    const title = (text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "Monthly article").slice(0, 200);
    await saveArticle({ monthKey, title, text, importedByName: byName.slice(0, 100), sourceId });
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

// ---- events edited by hand

/** "YYYY-MM-DDTHH:mm" as UTC (all-day events start at midnight). */
const parseWhen = (v: string, allDay: boolean): Date => new Date(allDay ? `${v.slice(0, 10)}T00:00:00Z` : `${v}:00Z`);

/** Adds (no id) or changes (with id) an event. Editing locks it, so a sync never overwrites it; a new one is a manual event. */
export async function saveEvent(input: GameEventInput): Promise<SimpleEventResult> {
  try {
    if (!(await findSource(input.sourceId))) return { ok: false, error: "notFound" };
    const start = parseWhen(input.start, input.allDay);
    const end = input.end ? parseWhen(input.end, input.allDay) : null;
    if (Number.isNaN(start.getTime()) || (end && (Number.isNaN(end.getTime()) || end.getTime() < start.getTime()))) return { ok: false, error: "badRange" };
    const data = { title: input.title, kind: input.kind, startsAt: start, endsAt: end, allDay: input.allDay, description: input.description, summary: input.summary, items: input.items, imageUrl: input.imageUrl || null, videoUrl: input.videoUrl || null, reminderDays: input.reminderDays };
    if (input.id) {
      const existing = await findEvent(input.id);
      if (!existing || existing.sourceId !== input.sourceId) return { ok: false, error: "notFound" };
      await updateEvent(existing.id, data);
    } else {
      await createManualEvent(input.sourceId, `manual|${randomUUID()}`, data);
    }
    await ensureItems(input.sourceId, input.items).catch(() => undefined);
    await reloadBotModule("eventcal");
    return { ok: true };
  } catch (error) {
    console.error("[eventcal] saving an event failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** A manual event is deleted; one from a calendar or article is hidden (and locked), so a sync doesn't bring it back. */
export async function removeEvent(id: string): Promise<SimpleEventResult> {
  try {
    const existing = await findEvent(id);
    if (!existing) return { ok: false, error: "notFound" };
    if (existing.origin === "manual") await deleteEvent(id);
    else await hideEvent(id);
    await reloadBotModule("eventcal");
    return { ok: true };
  } catch (error) {
    console.error("[eventcal] removing an event failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function bringBackEvent(id: string): Promise<SimpleEventResult> {
  try {
    if (!(await findEvent(id))) return { ok: false, error: "notFound" };
    await restoreEvent(id);
    await reloadBotModule("eventcal");
    return { ok: true };
  } catch (error) {
    console.error("[eventcal] restoring an event failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

// ---- pictures: item pictures and a game's background

/** Checks the bytes by their own header (the type comes from there, never from the upload's name) and returns what to store. */
type Checked = { ok: false; problem: "type" | "size" | "dimensions" } | { ok: true; picture: PictureData };

function checkedPicture(file: Uint8Array, by: string): Checked {
  const problem = cardImageProblem(file);
  if (problem) return { ok: false, problem };
  const info = readImageInfo(file)!;
  return { ok: true, picture: { data: new Uint8Array(file), contentType: info.type, width: info.width, height: info.height, uploadedByName: by.slice(0, 100) } };
}

export async function setItemPicture(itemId: string, file: Uint8Array, by: string): Promise<ImageResult> {
  try {
    const checked = checkedPicture(file, by);
    if (!checked.ok) return { ok: false, error: checked.problem };
    const item = await findItem(itemId);
    if (!item) return { ok: false, error: "notFound" };
    await setItemImage(itemId, checked.picture);
    await reloadBotModule("eventcal");
    return { ok: true };
  } catch (error) {
    console.error("[eventcal] storing an item picture failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function clearItemPicture(itemId: string): Promise<ImageResult> {
  try {
    if (!(await findItem(itemId))) return { ok: false, error: "notFound" };
    await clearItemImage(itemId);
    await reloadBotModule("eventcal");
    return { ok: true };
  } catch (error) {
    console.error("[eventcal] removing an item picture failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Removes an item from the library (it comes back by itself, without a picture, if an event still lists it). */
export async function removeItem(itemId: string): Promise<SimpleEventResult> {
  try {
    return (await deleteItem(itemId)) > 0 ? { ok: true } : { ok: false, error: "notFound" };
  } catch (error) {
    console.error("[eventcal] removing an item failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function setBackgroundPicture(sourceId: string, file: Uint8Array, by: string): Promise<ImageResult> {
  try {
    const checked = checkedPicture(file, by);
    if (!checked.ok) return { ok: false, error: checked.problem };
    if (!(await findSource(sourceId))) return { ok: false, error: "notFound" };
    await saveBackground(sourceId, checked.picture);
    await reloadBotModule("eventcal");
    return { ok: true };
  } catch (error) {
    console.error("[eventcal] storing a background failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function clearBackgroundPicture(sourceId: string): Promise<ImageResult> {
  try {
    await deleteBackground(sourceId);
    await reloadBotModule("eventcal");
    return { ok: true };
  } catch (error) {
    console.error("[eventcal] removing a background failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** The stored bytes for the admin-only routes that show the pictures. */
export async function getItemPictureFile(id: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const row = await readItemImage(id);
  return row?.imageData && row.imageType ? { bytes: new Uint8Array(row.imageData), contentType: row.imageType } : null;
}

export async function getBackgroundFile(sourceId: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const row = await readBackground(sourceId);
  return row ? { bytes: new Uint8Array(row.data), contentType: row.contentType } : null;
}

/** A sample picture drawn by the bot from the saved settings (an event's card, or a month's overview picture). */
export const previewPicture = (sourceId: string, eventId: string, month: "none" | "current" | "next") => getEventPreviewCard({ sourceId, eventId, month });

