import { Events, type Client, type Guild } from "discord.js";
import type { EventCheckResponse, EventOverviewStatus, EventRepostStatus } from "@aboutselphy/shared/eventcal";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { aiConfigured } from "../../lib/ai";
import type { CalEvent } from "./ics";
import { syncSource } from "./sync";
import { toCalEvent } from "./store";
import { claimMonth, clearSyncFlags, releaseMonth, setMonthly, claimPost, findPost, findPostById, updatePostMessage, pruneSummaries, readSummary, saveSummary, listStoredEvents, listRules, listSources, markSeeded, prunePosts, readSource, recordCheck, setOverview, setOverviewHash, setPostHash, setPostMessage, unclaimPost, type SourceState } from "./repository";
import { parseSummary, summarizeEvent, summaryKey, type EventSummaryData } from "./summary";
import { eventHash, eventMessage, firstSentence, monthEvents, monthLabel, monthlyEntries, monthlyHash, monthlyLine, monthlyMessages, planStages, matchesRule, overviewEvents, overviewHash, overviewMessage } from "./rules";

// The event calendar announcer. Every 30 minutes (and when the dashboard says so) it reads the calendar, then for every rule posts each
// matching event that starts within the rule's lead time, one message per event. An occurrence is claimed in the database BEFORE it is
// posted (a restart or a second check can't post it twice); if it changes later (moved, renamed, new text) its message is edited once.
// The first successful check only remembers what is there: nothing old is announced. One overview message is edited when its content changes.

const INTERVAL_MS = 30 * 60_000;
const DAY = 86_400_000;
const SYNC_EVERY_MS = 6 * 3_600_000;
const mutex = new KeyedMutex();
let timer: ReturnType<typeof setInterval> | undefined;
const MAX_AI_CALLS_PER_CHECK = 6;

/** The cached AI summary of an event, or a fresh one (at most a few new calls per check). Null when AI isn't set up or fails: the post then shows the event's own text. */
async function summaryFor(event: CalEvent, budget: { left: number }, game: string | null): Promise<EventSummaryData | null> {
  // Events that came through the article extraction already carry their summary, items and audience: no extra call.
  if (event.extra) return { summary: event.extra.summary, rewards: event.items ?? [], audience: event.extra.audience, blurb: event.extra.blurb };
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

/** The game a source is about, for the AI. */
const gameOf = (src: SourceState): string => src.name;

/** The stored events of a source as the posting code wants them. */
async function storedEvents(src: SourceState, now: Date): Promise<CalEvent[]> {
  return (await listStoredEvents(src.id, new Date(now.getTime() - 2 * DAY))).map(toCalEvent);
}

/**
 * One round for every enabled source (or just `sourceId`): bring its stored events up to date when they are older than six hours or `force` is set
 * (a dashboard change), then post from the stored events. Never throws; the outcome is stored for the dashboard as a short code.
 */
export function checkCalendar(guild: Guild, opts: { force?: boolean; sourceId?: string } = {}): Promise<EventCheckResponse> {
  return mutex.run("calendar", async () => {
    const total: EventCheckResponse = { status: "ok", events: 0, posted: 0, edited: 0 };
    for (const src of await listSources()) {
      if (opts.sourceId && src.id !== opts.sourceId) continue;
      const r = await (async () => {
        const stale = !src.lastFetchedAt || Date.now() - src.lastFetchedAt.getTime() > SYNC_EVERY_MS;
        if (opts.force || stale) {
          const synced = await syncSource(src).catch((err) => {
            log.error({ err, source: src.name }, "eventcal: syncing a source failed");
            return null;
          });
          if (synced && synced.status !== "ok") log.warn({ source: src.name, status: synced.status }, "eventcal: the sync did not fully succeed");
        }
        return checkSource(guild, src);
      })().catch((err) => {
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
      const loaded = await storedEvents(config, now);
      if (loaded.length === 0) return await finish("empty");
      result.events = loaded.length;
      const rules = await listRules(config.id);
      const budget = { left: MAX_AI_CALLS_PER_CHECK };

      for (const rule of rules) {
        for (const event of loaded.filter((e) => matchesRule(e, rule))) {
          // The event's own lead times (set in the dashboard) win over the rule's. Stage 0 is the announcement, later stages are reminders.
          const steps = planStages(event, now, event.reminderDays && event.reminderDays.length > 0 ? event.reminderDays : rule.leadDays);
          if (steps.length === 0) continue;
          const hash = eventHash(event);
          for (const step of steps) {
            const existing = await findPost(rule.id, event.key.slice(0, 160), step.stage);
            const claim = { ruleId: rule.id, eventKey: event.key, stage: step.stage, startsAt: event.start, channelId: rule.channelId, hash, messageId: null, title: event.summary };
            if (!config.baselined || !rule.seeded) {
              // First look at the calendar or at this rule: remember everything, announce nothing.
              await claimPost(claim);
              continue;
            }
            if (!existing && !step.post) {
              // A lead time that was missed and has been overtaken by a nearer one: done, without a message.
              await claimPost(claim);
              continue;
            }
            const channel = await textChannel(guild, rule.channelId);
            if (!channel) {
              log.warn({ rule: rule.id, channelId: rule.channelId }, "eventcal: the channel is missing or the bot can't post in it");
              continue;
            }
            const reminder = step.stage > 0;
            if (!existing) {
              if (!(await claimPost(claim))) continue;
              try {
                const message = await channel.send(eventMessage(event, rule.pingRoleId, rule.useAi ? await summaryFor(event, budget, game) : null, { reminder }));
                await setPostMessage(rule.id, event.key, step.stage, message.id);
                result.posted++;
                log.info({ rule: rule.id, event: event.summary, stage: step.stage, daysBefore: step.offset }, "eventcal: posted");
              } catch (err) {
                log.warn({ err, rule: rule.id }, "eventcal: could not post, will retry");
                await unclaimPost(rule.id, event.key, step.stage).catch(() => undefined);
              }
            } else if (existing.hash !== hash && existing.messageId) {
              const message = await channel.messages.fetch(existing.messageId).catch(() => null);
              if (message) {
                await message.edit({ ...eventMessage(event, rule.pingRoleId, rule.useAi ? await summaryFor(event, budget, game) : null, { reminder }), content: message.content }).then(async () => {
                  await setPostHash(rule.id, event.key, step.stage, hash);
                  result.edited++;
                  log.info({ rule: rule.id, event: event.summary, stage: step.stage }, "eventcal: edited (the event changed)");
                }).catch((err) => log.warn({ err }, "eventcal: could not edit"));
              }
            } else if (existing.hash !== hash) {
              await setPostHash(rule.id, event.key, step.stage, hash); // a silently remembered event changed: nothing to edit
            }
          }
        }
      }

      for (const rule of rules.filter((r) => !r.seeded)) await markSeeded(rule.id);

      await refreshOverview(guild, config.id, loaded, now).catch((err) => log.warn({ err }, "eventcal: could not refresh the overview"));
      await refreshMonthly(guild, config.id, loaded, now).catch((err) => log.warn({ err }, "eventcal: could not refresh the monthly summary"));
      await autoMonthly(guild, config, loaded, now).catch((err) => log.warn({ err }, "eventcal: the automatic monthly summary failed"));
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

/** The overview shows every event of the game that runs now or starts within the window, not only those a rule posts. */
async function overviewFor(loaded: CalEvent[], days: number, now: Date) {
  const shown = overviewEvents(loaded, now, days);
  return { shown, hash: overviewHash(shown) };
}

/** Edits the overview message when its content changed (only if one was posted from the dashboard). */
async function refreshOverview(guild: Guild, sourceId: string, loaded: CalEvent[], now: Date): Promise<void> {
  const config = await readSource(sourceId);
  if (!config) return;
  if (!config.overviewChannelId || !config.overviewMessageId) return;
  const { shown, hash } = await overviewFor(loaded, config.overviewDays, now);
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
      const config = post.rule.sourceId ? await readSource(post.rule.sourceId) : null;
      if (!config) return "gone";
      const loaded = await storedEvents(config, new Date());
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
async function refreshMonthly(guild: Guild, sourceId: string, loaded: CalEvent[], now: Date): Promise<void> {
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

/**
 * When a game has the automatic monthly summary on, posts it once as soon as the current month has events (so a new month's summary appears by
 * itself when its article is published). Never on a source's first look, and the month is claimed before posting, so two rounds can't both post.
 */
async function autoMonthly(guild: Guild, config: SourceState, loaded: CalEvent[], now: Date): Promise<void> {
  if (!config.summaryAuto || !config.summaryChannelId || !config.baselined) return;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const key = `${year}-${String(month).padStart(2, "0")}`;
  if (config.summaryMonth === key) return;
  if (monthEvents(loaded, year, month).length === 0) return;
  if (!(await claimMonth(config.id, key, config.summaryMonth))) return;
  const status = await postMonthly(guild, "current", config.id);
  if (status === "posted" || status === "updated") {
    log.info({ source: config.name, month: key }, "eventcal: the monthly summary was posted automatically");
    return;
  }
  await releaseMonth(config.id, key, config.summaryMonth).catch(() => undefined);
  log.warn({ source: config.name, month: key, status }, "eventcal: the automatic monthly summary could not be posted, will retry");
}

/** The dashboard's "Post monthly summary" for this month or the next. Every event of the month is listed, not only those a rule matches. */
export async function postMonthly(guild: Guild, which: "current" | "next", sourceId: string | null = null): Promise<EventOverviewStatus> {
  try {
    const config = sourceId ? await readSource(sourceId) : null;
    if (!config) return "needsSetup";
    if (!config.summaryChannelId) return "needsSetup";
    const now = new Date();
    const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + (which === "next" ? 1 : 0), 1));
    const year = target.getUTCFullYear();
    const month = target.getUTCMonth() + 1;
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const loaded = await storedEvents(config, now);
    const lines = await monthlyLines(loaded, year, month, { left: 15 }, gameOf(config));
    const existing = config.summaryMonth === key ? config.summaryMessageIds : [];
    const ids = await writeMonthly(guild, config.summaryChannelId, lines, monthLabel(year, month), existing);
    if (!ids) return "channel";
    await setMonthly(config.id, { summaryMonth: key, summaryMessageIds: ids, summaryHash: monthlyHash(lines) });
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
    const config = sourceId ? await readSource(sourceId) : null;
    if (!config) return "needsSetup";
    if (!config.overviewChannelId) return "needsSetup";
    const channel = await textChannel(guild, config.overviewChannelId);
    if (!channel) return "channel";
    const loaded = await storedEvents(config, new Date());
    const { shown, hash } = await overviewFor(loaded, config.overviewDays, new Date());
    const payload = overviewMessage(shown, config.overviewDays);
    const existing = config.overviewMessageId ? await channel.messages.fetch(config.overviewMessageId).catch(() => null) : null;
    if (existing) {
      await existing.edit(payload);
      await setOverview(config.id, channel.id, existing.id, hash);
      return "updated";
    }
    const message = await channel.send(payload);
    await setOverview(config.id, channel.id, message.id, hash);
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
  const run = async (force: boolean) => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return;
    await checkCalendar(guild, { force });
  };
  // A dashboard change (settings, a pasted article, a rule) reads the sources again at once; the timer only does so every six hours.
  onReload("eventcal", () => void run(true).catch((err) => log.error({ err }, "eventcal: run failed")));
  client.once(Events.ClientReady, () => {
    void clearSyncFlags().catch(() => undefined);
    void run(false).catch((err) => log.error({ err }, "eventcal: run failed"));
    timer = setInterval(() => void run(false).catch((err) => log.error({ err }, "eventcal: run failed")), INTERVAL_MS);
  });
}

export function stopEventCalendar(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
