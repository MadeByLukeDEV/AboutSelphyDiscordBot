import { Events, type Client, type Guild } from "discord.js";
import type { FeedSource } from "@aboutselphy/db";
import type { FeedCheckResponse } from "@aboutselphy/shared";
import { decryptToken } from "@aboutselphy/shared/token-cipher";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { getText } from "../../lib/safe-http";
import { parseFeed } from "./parse";
import { findFeed, listEnabled, markChecked, pruneItems, remember, rememberMany, seenGuids } from "./repository";
import { isDue, renderFeedMessage, selectNew } from "./rules";

// The feed announcer. A round every minute checks the feeds that are due (each has its own interval).
// A feed's first successful check only remembers what is there: nothing old is ever announced. After
// that, new items are announced oldest first, at most five per check, each remembered *before* it is
// posted (so a restart or a second check can never announce it twice). A failing feed is just marked
// with a short status; nothing about it is shown to members.

const URL_PURPOSE = "feed-url";
const ROUND_MS = 60_000;
const mutex = new KeyedMutex();
let timer: ReturnType<typeof setInterval> | undefined;
let lastPrune = 0;

/** Checks one feed. Never throws. */
export function checkFeed(guild: Guild, feed: FeedSource): Promise<FeedCheckResponse> {
  return mutex.run(feed.id, async () => {
    const done = async (status: string, announced = 0, baselined = false): Promise<FeedCheckResponse> => {
      await markChecked(feed.id, status, baselined).catch((err) => log.warn({ err }, "feeds: could not record the result"));
      if (status !== "ok") log.warn({ feed: feed.id, status }, "feeds: check did not succeed");
      return { status, announced };
    };
    try {
      const key = env().TOKEN_ENCRYPTION_KEY;
      if (!key) return await done("no key");
      let url: string;
      try {
        url = decryptToken(feed.urlEnc, URL_PURPOSE, key);
      } catch {
        return await done("key mismatch");
      }
      const res = await getText(url, { internalHosts: env().RSS_INTERNAL_HOSTS });
      if (!res.ok) return await done(res.reason);
      if (res.status < 200 || res.status >= 300) return await done(`http ${res.status}`);
      let items;
      try {
        items = parseFeed(res.body);
      } catch {
        return await done("parse");
      }
      if (items.length === 0) return await done("empty", 0, feed.baselined);

      const seen = await seenGuids(feed.id, items.map((i) => i.guid));
      if (!feed.baselined) {
        // First look: remember everything, announce nothing.
        await rememberMany(feed.id, items.filter((i) => !seen.has(i.guid)).map((i) => i.guid));
        log.info({ feed: feed.id, items: items.length }, "feeds: first check, current items remembered without announcing");
        return await done("ok", 0, true);
      }

      const { toPost, toRemember } = selectNew(items, seen, new Date());
      if (toRemember.length > 0) await rememberMany(feed.id, toRemember.map((i) => i.guid));
      const channel = toPost.length > 0 ? await guild.channels.fetch(feed.channelId).catch(() => null) : null;
      let announced = 0;
      for (const item of toPost) {
        if (!(await remember(feed.id, item.guid))) continue; // another check got it first
        if (!channel || channel.isDMBased() || !channel.isTextBased() || !("send" in channel)) {
          log.warn({ feed: feed.id, channelId: feed.channelId }, "feeds: the channel is missing or the bot can't post in it");
          return await done("channel", announced);
        }
        const text = renderFeedMessage(feed.messageTemplate, { name: feed.name, title: item.title, link: item.link });
        await channel
          .send({ content: `${feed.pingRoleId ? `<@&${feed.pingRoleId}> ` : ""}${text}`, allowedMentions: { parse: [], roles: feed.pingRoleId ? [feed.pingRoleId] : [] } })
          .then(() => {
            announced++;
            log.info({ feed: feed.id, guid: item.guid }, "feeds: announced");
          })
          .catch((err) => log.warn({ err, feed: feed.id }, "feeds: could not post an item"));
      }
      return await done("ok", announced);
    } catch (err) {
      log.error({ err, feed: feed.id }, "feeds: check failed");
      return await done("error");
    }
  });
}

/** The dashboard's "Check now". */
export async function checkFeedNow(guild: Guild, id: string): Promise<FeedCheckResponse | null> {
  const feed = await findFeed(id);
  return feed ? checkFeed(guild, feed) : null;
}

async function round(guild: Guild): Promise<void> {
  try {
    if (!(await moduleOn("feeds"))) return;
    const now = new Date();
    for (const feed of (await listEnabled()).filter((f) => isDue(f, now))) await checkFeed(guild, feed);
    if (Date.now() - lastPrune > 6 * 3_600_000) {
      lastPrune = Date.now();
      await pruneItems(new Date(Date.now() - 90 * 86_400_000));
    }
  } catch (err) {
    log.error({ err }, "feeds: round failed");
  }
}

/** Starts the rounds with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it posts in real channels). */
export function startFeeds(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "feeds: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const guildOf = () => client.guilds.cache.get(env().DISCORD_GUILD_ID);
  const run = () => {
    const guild = guildOf();
    if (guild) void round(guild);
  };
  onReload("feeds", run);
  client.once(Events.ClientReady, () => {
    run();
    timer = setInterval(run, ROUND_MS);
  });
}

export function stopFeeds(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
