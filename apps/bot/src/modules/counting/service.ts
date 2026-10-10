import { Events, type Client, type Message } from "discord.js";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { acceptNumber, readConfig, resetCount } from "./repository";
import { judge, mistakeMessage, parseCount } from "./rules";

// The counting channel. Every message in it that starts with a number is judged against the stored
// count (read fresh, one message at a time): the next number from someone else is accepted with a
// check mark; anything else is refused and, if configured, ends the streak. Messages that aren't a
// number are ignored, so people can still talk. Needs the Message Content intent and, in the channel,
// Add Reactions and Send Messages.

const mutex = new KeyedMutex();
const TTL_MS = 60_000;
let cached: { channelId: string | null; enabled: boolean; at: number } | undefined;

async function watchedChannel(): Promise<string | null> {
  if (!cached || Date.now() - cached.at >= TTL_MS) {
    const c = await readConfig();
    cached = { channelId: c.channelId, enabled: c.enabled, at: Date.now() };
  }
  return cached.enabled ? cached.channelId : null;
}

async function handle(message: Message): Promise<void> {
  const number = parseCount(message.content);
  if (number === null) return;
  const config = await readConfig(); // fresh: the count must be exact
  if (!config.enabled || config.channelId !== message.channelId) return;

  const verdict = judge({ current: config.currentCount, number, userId: message.author.id, lastUserId: config.lastUserId, allowConsecutive: config.allowConsecutive });
  if (verdict === "ok") {
    if (!(await acceptNumber(config.currentCount, number, message.author.id))) {
      log.info({ number }, "counting: lost a race, the number was refused");
      await message.react("❌").catch(() => undefined);
      return;
    }
    await message.react(number > config.highScore ? "🏆" : "✅").catch((err) => log.warn({ err }, "counting: could not react (Add Reactions?)"));
    log.info({ number, user: message.author.id }, "counting: accepted");
    return;
  }

  await message.react("❌").catch(() => undefined);
  if (verdict === "same-user") {
    await message.reply({ content: "You can't count twice in a row. Let someone else take the next number.", allowedMentions: { parse: [], repliedUser: false } }).catch(() => undefined);
    return;
  }
  const reset = config.resetOnMistake;
  if (reset) await resetCount();
  if (message.channel.isSendable()) await message.channel.send({ content: mistakeMessage(message.author.id, config.currentCount, reset), allowedMentions: { parse: [], users: [message.author.id] } }).catch(() => undefined);
  log.info({ number, expected: config.currentCount + 1, user: message.author.id, reset }, "counting: mistake");
}

/** Starts watching. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it reacts in a real channel). */
export function startCounting(client: Client): void {
  if (!integrationsActive() || !env().DISCORD_MESSAGE_CONTENT) {
    log.info({ messageContent: env().DISCORD_MESSAGE_CONTENT, integrations: integrationsActive() }, "counting: not starting (needs production or BOT_INTEGRATIONS_IN_DEV, and DISCORD_MESSAGE_CONTENT=true)");
    return;
  }
  onReload("counting", () => {
    cached = undefined;
  });
  client.on(Events.MessageCreate, (message) => {
    if (message.guildId !== env().DISCORD_GUILD_ID || message.author.bot || message.system) return;
    void watchedChannel()
      .then((channelId) => (channelId === message.channelId ? mutex.run(message.channelId, () => handle(message)) : undefined))
      .catch((err) => log.warn({ err }, "counting: handler failed"));
  });
}
