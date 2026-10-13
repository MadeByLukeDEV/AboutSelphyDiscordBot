import { Events, type Client, type Guild } from "discord.js";
import type { EventCheckResponse, EventOverviewStatus } from "@aboutselphy/shared/eventcal";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { getText } from "../../lib/safe-http";
import { parseArticle } from "@aboutselphy/shared/eventcal-article";
import { aiConfigured } from "../../lib/ai";
import { parseCalendar, type CalEvent } from "./ics";
import { claimPost, findPost, pruneSummaries, readSummary, saveSummary, listArticles, listRules, markSeeded, prunePosts, readConfig, recordCheck, setOverview, setOverviewHash, setPostHash, setPostMessage, unclaimPost } from "./repository";
import { parseSummary, summarizeEvent, summaryKey, type EventSummaryData } from "./summary";
import { eventHash, eventMessage, isPostable, matchesRule, mergeArticle, overviewEvents, overviewHash, overviewMessage } from "./rules";

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
async function summaryFor(event: CalEvent, budget: { left: number }): Promise<EventSummaryData | null> {
  if (!aiConfigured()) return null;
  const key = summaryKey(event);
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
  const fresh = await summarizeEvent(event);
  if (fresh) await saveSummary(key, JSON.stringify(fresh)).catch(() => undefined);
  return fresh;
}

async function textChannel(guild: Guild, id: string) {
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === env().DISCORD_GUILD_ID && channel.isTextBased() && "send" in channel ? channel : null;
}

async function loadEvents(url: string, now: Date): Promise<CalEvent[] | string> {
  const res = await getText(url, { maxBytes: MAX_BYTES, timeoutMs: 20_000 });
  if (!res.ok) return res.detail ? `${res.reason}: ${res.detail}`.slice(0, 40) : res.reason;
  if (res.status < 200 || res.status >= 300) return `http ${res.status}`;
  try {
    const from = new Date(now.getTime() - 2 * DAY);
    const to = new Date(now.getTime() + 120 * DAY);
    const events = parseCalendar(res.body, from, to);
    // Imported news articles add the dates and details the calendar lacks.
    const articles = (await listArticles()).flatMap((a) => parseArticle(a.text));
    return articles.length > 0 ? mergeArticle(events, articles, from, to) : events;
  } catch {
    return "parse";
  }
}

/** One check. Never throws; the outcome is stored for the dashboard as a short code. */
export function checkCalendar(guild: Guild): Promise<EventCheckResponse> {
  return mutex.run("calendar", async () => {
    const result = { status: "ok", events: 0, posted: 0, edited: 0 };
    const finish = async (status: string, baselined = false): Promise<EventCheckResponse> => {
      result.status = status;
      await recordCheck(status, baselined).catch((err) => log.warn({ err }, "eventcal: could not record the result"));
      if (status !== "ok") log.warn({ status }, "eventcal: check did not succeed");
      return result;
    };
    try {
      const config = await readConfig();
      const now = new Date();
      const loaded = await loadEvents(config.icsUrl, now);
      if (typeof loaded === "string") return await finish(loaded);
      if (loaded.length === 0) return await finish("empty");
      result.events = loaded.length;
      const rules = await listRules();
      const budget = { left: MAX_AI_CALLS_PER_CHECK };

      for (const rule of rules) {
        const matching = loaded.filter((e) => matchesRule(e, rule) && isPostable(e, now, rule.daysAhead));
        for (const event of matching) {
          const hash = eventHash(event);
          const existing = await findPost(rule.id, event.key.slice(0, 160));
          if (!config.baselined || !rule.seeded) {
            // First look at the calendar or at this rule: remember everything, announce nothing.
            await claimPost({ ruleId: rule.id, eventKey: event.key, startsAt: event.start, channelId: rule.channelId, hash, messageId: null });
            continue;
          }
          const channel = await textChannel(guild, rule.channelId);
          if (!channel) {
            log.warn({ rule: rule.id, channelId: rule.channelId }, "eventcal: the channel is missing or the bot can't post in it");
            continue;
          }
          if (!existing) {
            if (!(await claimPost({ ruleId: rule.id, eventKey: event.key, startsAt: event.start, channelId: rule.channelId, hash, messageId: null }))) continue;
            try {
              const message = await channel.send(eventMessage(event, rule.pingRoleId, rule.useAi ? await summaryFor(event, budget) : null));
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
              await message.edit({ ...eventMessage(event, rule.pingRoleId, rule.useAi ? await summaryFor(event, budget) : null), content: message.content }).then(async () => {
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

      await refreshOverview(guild, loaded, rules, now).catch((err) => log.warn({ err }, "eventcal: could not refresh the overview"));
      if (Math.random() < 0.05) {
        await prunePosts(new Date(now.getTime() - 120 * DAY));
        await pruneSummaries(new Date(now.getTime() - 120 * DAY));
      }
      return await finish("ok", true);
    } catch (err) {
      log.error({ err }, "eventcal: check failed");
      return await finish("error");
    }
  });
}

async function overviewFor(loaded: CalEvent[], rules: Awaited<ReturnType<typeof listRules>>, days: number, now: Date) {
  const shown = overviewEvents(loaded.filter((e) => rules.some((r) => matchesRule(e, r))), now, days);
  return { shown, hash: overviewHash(shown) };
}

/** Edits the overview message when its content changed (only if one was posted from the dashboard). */
async function refreshOverview(guild: Guild, loaded: CalEvent[], rules: Awaited<ReturnType<typeof listRules>>, now: Date): Promise<void> {
  const config = await readConfig();
  if (!config.overviewChannelId || !config.overviewMessageId) return;
  const { shown, hash } = await overviewFor(loaded, rules, config.overviewDays, now);
  if (hash === config.overviewHash) return;
  const channel = await textChannel(guild, config.overviewChannelId);
  const message = channel ? await channel.messages.fetch(config.overviewMessageId).catch(() => null) : null;
  if (!message) return void log.warn({ channelId: config.overviewChannelId }, "eventcal: the overview message is gone (post it again from the dashboard)");
  await message.edit(overviewMessage(shown, config.overviewDays));
  await setOverviewHash(hash);
  log.info({ events: shown.length }, "eventcal: overview updated");
}

/** The dashboard's "Post / update overview": posts the message, or edits the existing one. */
export async function postOverview(guild: Guild): Promise<EventOverviewStatus> {
  try {
    const config = await readConfig();
    if (!config.overviewChannelId) return "needsSetup";
    const channel = await textChannel(guild, config.overviewChannelId);
    if (!channel) return "channel";
    const loaded = await loadEvents(config.icsUrl, new Date());
    if (typeof loaded === "string") return "failed";
    const rules = await listRules();
    const { shown, hash } = await overviewFor(loaded, rules, config.overviewDays, new Date());
    const payload = overviewMessage(shown, config.overviewDays);
    const existing = config.overviewMessageId ? await channel.messages.fetch(config.overviewMessageId).catch(() => null) : null;
    if (existing) {
      await existing.edit(payload);
      await setOverview(channel.id, existing.id, hash);
      return "updated";
    }
    const message = await channel.send(payload);
    await setOverview(channel.id, message.id, hash);
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
    if (!(await readConfig()).enabled) return;
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
