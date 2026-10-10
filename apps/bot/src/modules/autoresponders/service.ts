import { Events, type Client } from "discord.js";
import type { AutoResponder } from "@aboutselphy/db";
import type { MatchType } from "@aboutselphy/shared/auto-responders";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { countUse, listEnabled } from "./repository";
import { allowedIn, Cooldowns, matches, renderResponse } from "./rules";

// Auto-responders. The first enabled responder whose trigger is in a message answers it, as a reply
// that pings nobody. Each responder has its own cooldown per channel, and a channel gets at most one
// automatic answer every 5 seconds, so a busy chat can't make the bot spam. Needs the Message Content intent.

const TTL_MS = 60_000;
const CHANNEL_GAP_SECONDS = 5;
let cache: { rows: AutoResponder[]; at: number } | undefined;
const cooldowns = new Cooldowns();

async function responders(): Promise<AutoResponder[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rows;
  cache = { rows: await listEnabled(), at: Date.now() };
  return cache.rows;
}

/** Starts watching. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it answers in real channels). */
export function startAutoResponders(client: Client): void {
  if (!integrationsActive() || !env().DISCORD_MESSAGE_CONTENT) {
    log.info({ messageContent: env().DISCORD_MESSAGE_CONTENT, integrations: integrationsActive() }, "auto-responders: not starting (needs production or BOT_INTEGRATIONS_IN_DEV, and DISCORD_MESSAGE_CONTENT=true)");
    return;
  }
  onReload("autoresponders", () => {
    cache = undefined;
  });
  client.on(Events.MessageCreate, (message) => {
    if (message.guildId !== env().DISCORD_GUILD_ID || message.author.bot || message.system || !message.content) return;
    void (async () => {
      const hit = (await responders()).find((r) => allowedIn(r.channelIds, message.channelId) && matches(r.matchType as MatchType, r.trigger, message.content));
      if (!hit) return;
      if (!cooldowns.take(`channel:${message.channelId}`, CHANNEL_GAP_SECONDS) || !cooldowns.take(`${hit.id}:${message.channelId}`, hit.cooldownSeconds)) {
        log.debug({ responder: hit.id }, "auto-responder: skipped (cooldown)");
        return;
      }
      await message.reply({ content: renderResponse(hit.response, { id: message.author.id, username: message.member?.displayName ?? message.author.username }), allowedMentions: { parse: [], repliedUser: false } });
      await countUse(hit.id).catch(() => undefined);
      log.info({ responder: hit.id, channelId: message.channelId }, "auto-responder: answered");
    })().catch((err) => log.warn({ err }, "auto-responder: could not answer"));
  });
}
