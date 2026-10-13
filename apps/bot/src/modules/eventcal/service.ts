import { Events, type Client, type Guild } from "discord.js";
import type { EventCheckResponse, EventOverviewStatus, EventRepostStatus } from "@aboutselphy/shared/eventcal";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { getText } from "../../lib/safe-http";
import { parseArticle } from "@aboutselphy/shared/eventcal-article";
import { aiConfigured } from "../../lib/ai";
import { parseCalendar, type CalEvent } from "./ics";
import { setMonthly, claimPost, findPost, findPostById, updatePostMessage, pruneSummaries, readSummary, saveSummary, listArticles, listRules, listSources, markSeeded, prunePosts, readSource, recordCheck, setOverview, setOverviewHash, setPostHash, setPostMessage, unclaimPost, type SourceState } from "./repository";
import { parseSummary, summarizeEvent, summaryKey, type EventSummaryData } from "./summary";
import { eventHash, eventMessage, firstSentence, monthEvents, monthLabel, monthlyEntries, monthlyHash, monthlyLine, monthlyMessages, isPostable, matchesRule, mergeArticle, overviewEvents, overviewHash, overviewMessage } from "./rules";

// The event calendar announcer. Every 30 minutes (and when the dashboard says so) it reads the calendar, then for every rule posts each
// matching event that starts within the rule's lead time, one message per event. An occurrence is claimed in the database BEFORE it is
// posted (a restart or a second check can't post it twice); if it changes later (moved, renamed, new text) its message is edited once.
// The first successful check only remembers what is there: nothing old is announced. One overview message is edited when its content changes.

const INTERVAL_MS = 30 * 60_000;
const DAY = 86_400_000;
const MAX_BYTES = 4_000_000;
const mutex = new KeyedMutex();
let timer: ReturnType<typeof setInterval> | undefined;
const MAX_AI_CALLS_PER_CHECK = 6;

/** The cached AI summary of an event, or a fresh one (at most a few new calls per check). Null when AI isn't set up or fails: the post then shows the event's own text. */
async function summaryFor(event: CalEvent, budget: { left: number }, game: string | null): Promise<EventSummaryData | null> {
  if (!aiConfigured()) return null;
  const key = summaryKey(event, game);
  const cached = await readSummary(key);
  if (cached) {
    try {
      return parseSummary(JSON.parse(cached));
    } catch {
      // a damaged cache row: ask again
    }
  }
  if (budget.left <= 0) return null;
  budget.left--;
  const fresh = await summarizeEvent(event, game);
  if (fresh) await saveSummary(key, JSON.stringify(fresh)).catch(() => undefined);
  return fresh;
}

async function textChannel(guild: Guild, id: string) {
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === env().DISCORD_GUILD_ID && channel.isTextBased() && "send" in channel ? channel : null;
}

/** The game a source is about, for the AI. The main calendar needs no hint. */
const gameOf = (src: SourceState): string | null => (src.id ? src.name : null);

async function loadEvents(src: SourceState, now: Date): Promise<CalEvent[] | string> {
  const from = new Date(now.getTime() - 2 * DAY);
  const to = new Date(now.getTime() + 120 * DAY);
  if (!src.icsUrl) {
    // A game without a calendar feed: its events are the sections of its pasted articles.
    try {
      const articles = (await listArticles(src.id)).flatMap((a) => parseArticle(a.text));
      return mergeArticle([], articles, from, to);
    } catch {
      return "parse";
    }
  }
  const res = await getText(src.icsUrl, { maxBytes: MAX_BYTES, timeoutMs: 20_000 });
  if (!res.ok) return res.detail ? `${res.reason}: ${res.detail}`.slice(0, 40) : res.reason;
  if (res.status < 200 || res.status >= 300) return `http ${res.status}`;
  try {
    const events = parseCalendar(res.body, from, to);
    // Imported news articles add the dates and details the calendar lacks.
    const articles = (await listArticles(src.id)).flatMap((a) => parseArticle(a.text));
    return articles.length > 0 ? mergeArticle(events, articles, from, to) : events;
  } catch {
    return "parse";
  }
}

/** One check of every source (the main calendar if switched on, and each enabled game). Never throws; the outcome is stored for the dashboard as a short code. */
export function checkCalendar(guild: Guild): Promise<EventCheckResponse> {
  return mutex.run("calendar", async () => {
    const total: EventCheckResponse = { status: "ok", events: 0, posted: 0, edited: 0 };
    const main = await readSource(null);
    for (const src of await listSources()) {
      if (src.id === null && !main?.enabled) continue;
      const r = await checkSource(guild, src).catch((err) => {
        log.error({ err }, "eventcal: a source failed");
        return { status: "error", events: 0, posted: 0, edited: 0 };
      });
      total.events += r.events;
      total.posted += r.posted;
      total.edited += r.edited;
      if (r.status !== "ok" && total.status === "ok") total.status = r.status;
    }
    return total;
  });
}

async function checkSource(guild: Guild, config: SourceState): Promise<EventCheckResponse> {
  {
    const result = { status: "ok", events: 0, posted: 0, edited: 0 };
    const finish = async (status: string, baselined = false): Promise<EventCheckResponse> => {
      result.status = status;
      await recordCheck(config.id, status, baselined).catch((err) => log.warn({ err }, "eventcal: could not record the result"));
      if (status !== "ok") log.warn({ status }, "eventcal: check did not succeed");
      return result;
    };
    try {
      const now = new Date();
      const game = gameOf(config);
      const loaded = await loadEvents(config, now);
      if (typeof loaded === "string") return await finish(loaded);
      if (loaded.length === 0) return await finish("empty");
      result.events = loaded.length;
      const rules = await listRules(config.id);
      const budget = { left: MAX_AI_CALLS_PER_CHECK };

      for (const rule of rules) {
        const matching = loaded.filter((e) => matchesRule(e, rule) && isPostable(e, now, rule.daysAhead));
        for (const event of matching) {
          const hash = eventHash(event);
          const existing = await findPost(rule.id, event.key.slice(0, 160));
          if (!config.baselined || !rule.seeded) {
            // First look at the calendar or at this rule: remember everything, announce nothing.
            await claimPost({ ruleId: rule.id, eventKey: event.key, startsAt: event.start, channelId: rule.channelId, hash, messageId: null, title: event.summary });
            continue;
          }
          const channel = await textChannel(guild, rule.channelId);
          if (!channel) {
            log.warn({ rule: rule.id, channelId: rule.channelId }, "eventcal: the channel is missing or the bot can't post in it");
            continue;
          }
          if (!existing) {
            if (!(await claimPost({ ruleId: rule.id, eventKey: event.key, startsAt: event.start, channelId: rule.channelId, hash, messageId: null, title: event.summary }))) continue;
            try {
              const message = await channel.send(eventMessage(event, rule.pingRoleId, rule.useAi ? await summaryFor(event, budget, game) : null));
              await setPostMessage(rule.id, event.key, message.id);
              result.posted++;
              log.info({ rule: rule.id, event: event.summary }, "eventcal: posted");
            } catch (err) {
              log.warn({ err, rule: rule.id }, "eventcal: could not post, will retry");
              await unclaimPost(rule.id, event.key).catch(() => undefined);
            }
          } else if (existing.hash !== hash && existing.messageId) {
            const message = await channel.messages.fetch(existing.messageId).catch(() => null);
            if (message) {
              await message.edit({ ...eventMessage(event, rule.pingRoleId, rule.useAi ? await summaryFor(event, budget, game) : null), content: message.content }).then(async () => {
                await setPostHash(rule.id, event.key, hash);
                result.edited++;
                log.info({ rule: rule.id, event: event.summary }, "eventcal: edited (the event changed)");
              }).catch((err) => log.warn({ err }, "eventcal: could not edit"));
            }
          } else if (existing.hash !== hash) {
            await setPostHash(rule.id, event.key, hash); // a silently remembered event changed: nothing to edit
          }
        }
      }

      for (const rule of rules.filter((r) => !r.seeded)) await markSeeded(rule.id);

      await refreshOverview(guild, config.id, loaded, rules, now).catch((err) => log.warn({ err }, "eventcal: could not refresh the overview"));
      await refreshMonthly(guild, config.id, loaded, now).catch((err) => log.warn({ err }, "eventcal: could not refresh the monthly summary"));
      if (Math.random() < 0.05) {
        await prunePosts(new Date(now.getTime() - 120 * DAY));
        await pruneSummaries(new Date(now.getTime() - 120 * DAY));
      }
      return await finish("ok", true);
    } catch (err) {
      log.error({ err }, "eventcal: check failed");
      return await finish("error");
    }
  }
}

type Rules = Awaited<ReturnType<typeof listRules>>;

async function overviewFor(loaded: CalEvent[], rules: Rules, days: number, now: Date) {
  const shown = overviewEvents(loaded.filter((e) => rules.some((r) => matchesRule(e, r))), now, days);
  return { shown, hash: overviewHash(shown) };
}

/** Edits the overview message when its content changed (only if one was posted from the dashboard). */
async function refreshOverview(guild: Guild, sourceId: string | null, loaded: CalEvent[], rules: Rules, now: Date): Promise<void> {
  const config = await readSource(sourceId);
  if (!config) return;
  if (!config.overviewChannelId || !config.overviewMessageId) return;
  const { shown, hash } = await overviewFor(loaded, rules, config.overviewDays, now);
  if (hash === config.overviewHash) return;
  const channel = await textChannel(guild, config.overviewChannelId);
  const message = channel ? await channel.messages.fetch(config.overviewMessageId).catch(() => null) : null;
  if (!message) return void log.warn({ channelId: config.overviewChannelId }, "eventcal: the overview message is gone (post it again from the dashboard)");
  await message.edit(overviewMessage(shown, config.overviewDays));
  await setOverviewHash(sourceId, hash);
  log.info({ events: shown.length }, "eventcal: overview updated");
}

/**
 * The dashboard's "Repost": posts one event again with the current text (and AI summary), deletes the old message, and keeps the row pointing at the new one.
 * Runs inside the same lock as the checks so it can't race a check.
 */
export function repostEvent(guild: Guild, postId: string): Promise<EventRepostStatus> {
  return mutex.run("calendar", async () => {
    try {
      const post = await findPostById(postId);
      if (!post) return "not-found";
      const config = await readSource(post.rule.sourceId);
      if (!config) return "gone";
      const loaded = await loadEvents(config, new Date());
      if (typeof loaded === "string") return "failed";
      const event = loaded.find((e) => e.key.slice(0, 160) === post.eventKey);
      if (!event) return "gone"; // the calendar no longer has this occurrence
      const channel = await textChannel(guild, post.rule.channelId);
      if (!channel) return "channel";
      const summary = post.rule.useAi ? await summaryFor(event, { left: 1 }, gameOf(config)) : null;
      const message = await channel.send(eventMessage(event, post.rule.pingRoleId, summary));
      const oldChannel = post.messageId ? await textChannel(guild, post.channelId) : null;
      if (post.messageId && oldChannel) await oldChannel.messages.delete(post.messageId).catch(() => undefined);
      await updatePostMessage(post.id, message.id, eventHash(event));
      log.info({ rule: post.ruleId, event: event.summary }, "eventcal: reposted from the dashboard");
      return "done";
    } catch (err) {
      log.error({ err }, "eventcal: reposting failed");
      return "failed";
    }
  });
}

/** The lines of the monthly summary for a month: one per event or weekly series, with an AI blurb when there is one, else the first sentence of the text. */
async function monthlyLines(loaded: CalEvent[], year: number, month: number, budget: { left: number }, game: string | null): Promise<string[]> {
  const entries = monthlyEntries(monthEvents(loaded, year, month));
  const lines: string[] = [];
  for (const entry of entries) {
    const ai = await summaryFor(entry.event, budget, game);
    const blurb = ai?.blurb || firstSentence(entry.event.description, 280);
    lines.push(monthlyLine(entry, blurb));
  }
  return lines;
}

/** Posts or edits the monthly summary's messages in place; extra old ones are deleted. Returns the message ids. */
async function writeMonthly(guild: Guild, channelId: string, lines: string[], label: string, existing: string[]): Promise<string[] | null> {
  const channel = await textChannel(guild, channelId);
  if (!channel) return null;
  const messages = monthlyMessages(lines, label);
  const ids: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const old = existing[i] ? await channel.messages.fetch(existing[i]!).catch(() => null) : null;
    if (old) {
      await old.edit(messages[i]!);
      ids.push(old.id);
    } else {
      ids.push((await channel.send(messages[i]!)).id);
    }
  }
  for (const extra of existing.slice(messages.length)) await channel.messages.delete(extra).catch(() => undefined);
  return ids;
}

/** Keeps a posted summary of the current month up to date (only when its content changed). */
async function refreshMonthly(guild: Guild, sourceId: string | null, loaded: CalEvent[], now: Date): Promise<void> {
  const config = await readSource(sourceId);
  if (!config) return;
  const key = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (!config.summaryChannelId || config.summaryMonth !== key || config.summaryMessageIds.length === 0) return;
  const lines = await monthlyLines(loaded, now.getUTCFullYear(), now.getUTCMonth() + 1, { left: 3 }, gameOf(config));
  const hash = monthlyHash(lines);
  if (hash === config.summaryHash) return;
  const ids = await writeMonthly(guild, config.summaryChannelId, lines, monthLabel(now.getUTCFullYear(), now.getUTCMonth() + 1), config.summaryMessageIds);
  if (ids) {
    await setMonthly(sourceId, { summaryMonth: key, summaryMessageIds: ids, summaryHash: hash });
    log.info({ messages: ids.length }, "eventcal: monthly summary updated");
  }
}

/** The dashboard's "Post monthly summary" for this month or the next. Every event of the month is listed, not only those a rule matches. */
export async function postMonthly(guild: Guild, which: "current" | "next", sourceId: string | null = null): Promise<EventOverviewStatus> {
  try {
    const config = await readSource(sourceId);
    if (!config) return "needsSetup";
    if (!config.summaryChannelId) return "needsSetup";
    const now = new Date();
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + (which === "next" ? 1 : 0), 1));
    const year = target.getUTCFullYear();
    const month = target.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const loaded = await loadEvents(config, now);
    if (typeof loaded === "string") return "failed";
    const lines = await monthlyLines(loaded, year, month, { left: 15 }, gameOf(config));
    const existing = config.summaryMonth === key ? config.summaryMessageIds : [];
    const ids = await writeMonthly(guild, config.summaryChannelId, lines, monthLabel(year, month), existing);
    if (!ids) return "channel";
    await setMonthly(sourceId, { summaryMonth: key, summaryMessageIds: ids, summaryHash: monthlyHash(lines) });
    log.info({ month: key, messages: ids.length }, "eventcal: monthly summary posted");
    return existing.length > 0 ? "updated" : "posted";
  } catch (err) {
    log.error({ err }, "eventcal: posting the monthly summary failed");
    return "failed";
  }
}

/** The dashboard's "Post / update overview": posts the message, or edits the existing one. */
export async function postOverview(guild: Guild, sourceId: string | null = null): Promise<EventOverviewStatus> {
  try {
    const config = await readSource(sourceId);
    if (!config) return "needsSetup";
    if (!config.overviewChannelId) return "needsSetup";
    const channel = await textChannel(guild, config.overviewChannelId);
    if (!channel) return "channel";
    const loaded = await loadEvents(config, new Date());
    if (typeof loaded === "string") return "failed";
    const rules = await listRules(sourceId);
    const { shown, hash } = await overviewFor(loaded, rules, config.overviewDays, new Date());
    const payload = overviewMessage(shown, config.overviewDays);
    const existing = config.overviewMessageId ? await channel.messages.fetch(config.overviewMessageId).catch(() => null) : null;
    if (existing) {
      await existing.edit(payload);
      await setOverview(sourceId, channel.id, existing.id, hash);
      return "updated";
    }
    const message = await channel.send(payload);
    await setOverview(sourceId, channel.id, message.id, hash);
    log.info({ channelId: channel.id }, "eventcal: overview posted");
    return "posted";
  } catch (err) {
    log.error({ err }, "eventcal: posting the overview failed");
    return "failed";
  }
}

/** Starts the checks with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it posts in real channels). */
export function startEventCalendar(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "eventcal: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const run = async () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return;
    await checkCalendar(guild);
  };
  onReload("eventcal", () => void run().catch((err) => log.error({ err }, "eventcal: run failed")));
  client.once(Events.ClientReady, () => {
    void run().catch((err) => log.error({ err }, "eventcal: run failed"));
    timer = setInterval(() => void run().catch((err) => log.error({ err }, "eventcal: run failed")), INTERVAL_MS);
  });
}

export function stopEventCalendar(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
