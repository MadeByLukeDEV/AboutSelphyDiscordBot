import { EmbedBuilder, Events, type Client, type Guild } from "discord.js";
import type { ProductWatch } from "@aboutselphy/db";
import { PRODUCT_WATCH_INTERVAL_MINUTES, parseProductUrl } from "@aboutselphy/shared/productwatch";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { escapeText, truncate } from "../../lib/escape";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { getText } from "../../lib/safe-http";
import { listEnabled, recordLook } from "./repository";
import { changeText, diffSnapshots, parseProductJs, readSnapshot } from "./rules";

// Product watch. A round every minute looks at the products that are due (every 30 minutes, or all of them when the dashboard asks).
// The first successful look only remembers what the product looks like; after that every change in price, availability, name or
// options is announced once. The new look is stored BEFORE the message is posted, so a restart or a second round can't repeat it.
// A failing look only sets a short status; nothing about it reaches members.

const ROUND_MS = 60_000;
const mutex = new KeyedMutex();
let timer: ReturnType<typeof setInterval> | undefined;

const isDue = (w: ProductWatch, now: Date) => !w.lastCheckedAt || now.getTime() - w.lastCheckedAt.getTime() >= PRODUCT_WATCH_INTERVAL_MINUTES * 60_000;

/** One look at one product. Never throws. */
function lookAt(guild: Guild, watch: ProductWatch): Promise<void> {
  return mutex.run(watch.id, async () => {
    const done = async (status: string) => {
      await recordLook(watch.id, status).catch((err) => log.warn({ err }, "productwatch: could not record the result"));
      if (status !== "ok") log.warn({ watch: watch.id, status }, "productwatch: look did not succeed");
    };
    try {
      const parts = parseProductUrl(watch.url);
      if (!parts) return await done("bad address");
      const res = await getText(parts.jsUrl, { maxBytes: 500_000, headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; AboutSelphyBot)" } });
      if (!res.ok) return await done(res.detail ? `${res.reason}: ${res.detail}` : res.reason);
      if (res.status === 404) return await done("gone");
      if (res.status < 200 || res.status >= 300) return await done(`http ${res.status}`);
      const now = parseProductJs(res.body);
      if (!now) return await done("unreadable");

      const before = readSnapshot(watch.snapshot);
      if (!watch.baselined || !before) {
        await recordLook(watch.id, "ok", { value: now, changed: false });
        log.info({ watch: watch.id }, "productwatch: first look, remembered without announcing");
        return;
      }
      const changes = diffSnapshots(before, now);
      if (changes.length === 0) return await done("ok");

      // Remember the new look first, then announce it.
      await recordLook(watch.id, "ok", { value: now, changed: true });
      const channel = await guild.channels.fetch(watch.channelId).catch(() => null);
      if (!channel || channel.isDMBased() || !channel.isTextBased() || !("send" in channel)) {
        log.warn({ watch: watch.id, channelId: watch.channelId }, "productwatch: the channel is missing or the bot can't post in it");
        return;
      }
      const embed = new EmbedBuilder()
        .setColor(0x00ffa8)
        .setTitle(truncate(`Changed: ${escapeText(watch.name)}`, 256))
        .setURL(parts.pageUrl)
        .setDescription(changeText(changes, now.variants.length === 1))
        .setFooter({ text: "Prices are in the shop's own currency" })
        .setTimestamp(new Date());
      if (now.image) embed.setThumbnail(now.image);
      await channel
        .send({ content: watch.pingRoleId ? `<@&${watch.pingRoleId}>` : undefined, embeds: [embed], allowedMentions: { parse: [], roles: watch.pingRoleId ? [watch.pingRoleId] : [] } })
        .then(() => log.info({ watch: watch.id, changes: changes.length }, "productwatch: announced a change"))
        .catch((err) => log.warn({ err, watch: watch.id }, "productwatch: could not post the change"));
    } catch (err) {
      log.error({ err, watch: watch.id }, "productwatch: look failed");
      await done("error");
    }
  });
}

async function round(guild: Guild, force: boolean): Promise<void> {
  try {
    const now = new Date();
    for (const watch of (await listEnabled()).filter((w) => force || isDue(w, now))) await lookAt(guild, watch);
  } catch (err) {
    log.error({ err }, "productwatch: round failed");
  }
}

/** Starts the rounds with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it posts in real channels). */
export function startProductWatch(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "productwatch: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const guildOf = () => client.guilds.cache.get(env().DISCORD_GUILD_ID);
  // The dashboard saved or asked for a check: look at every product now.
  onReload("productwatch", () => {
    const guild = guildOf();
    if (guild) void round(guild, true);
  });
  client.once(Events.ClientReady, () => {
    const run = () => {
      const guild = guildOf();
      if (guild) void round(guild, false);
    };
    run();
    timer = setInterval(run, ROUND_MS);
  });
}

export function stopProductWatch(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
