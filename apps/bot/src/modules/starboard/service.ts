import { Events, type Client, type Message, type MessageReaction, type PartialMessage, type PartialMessageReaction, type PartialUser, type User } from "discord.js";
import { env } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { truncate } from "../../lib/escape";
import { getStarboardConfig } from "./config";
import { clearBoardMessage, deletePost, findByBoardMessage, findPost, setStars, upsertPost } from "./repository";
import { buildStarMessage, countStars, decide, isIgnoredChannel, isStarEmoji, medal, safeImage } from "./rules";

// The starboard. Reactions are handled one message at a time (KeyedMutex) because a burst of
// reactions would otherwise post the same message twice. The count is recomputed from Discord
// every time, never incremented, so a missed event heals on the next one. Messages in NSFW
// channels and in the starboard channel itself never count.

const mutex = new KeyedMutex();
const FETCH_LIMIT = 100;

async function reactors(reaction: MessageReaction): Promise<string[]> {
  const users = await reaction.users.fetch({ limit: FETCH_LIMIT });
  return [...users.values()].filter((u) => !u.bot).map((u) => u.id);
}

async function onReaction(reactionIn: MessageReaction | PartialMessageReaction, userIn: User | PartialUser): Promise<void> {
  if (userIn.bot || !(await moduleOn("starboard"))) return;
  const reaction = reactionIn.partial ? await reactionIn.fetch().catch(() => null) : reactionIn;
  if (!reaction) return;
  const guild = reaction.message.guild;
  if (!guild || guild.id !== env().DISCORD_GUILD_ID) return;

  const config = await getStarboardConfig();
  if (!config.enabled || !config.channelId) return;
  if (!isStarEmoji(config.emoji, { id: reaction.emoji.id, name: reaction.emoji.name })) return;
  if (reaction.message.channelId === config.channelId) return;
  const parentId = "parentId" in reaction.message.channel ? (reaction.message.channel.parentId ?? null) : null;
  if (isIgnoredChannel(reaction.message.channelId, parentId, config.ignoredChannelIds)) return void log.debug({ channelId: reaction.message.channelId }, "starboard: skipped (ignored channel)");

  await mutex.run(reaction.message.id, async () => {
    const message = reaction.message.partial ? await reaction.message.fetch().catch(() => null) : reaction.message;
    if (!message || !message.guild) return;
    const channel = message.channel;
    if (channel.isDMBased() || ("nsfw" in channel && channel.nsfw)) {
      log.debug({ message: message.id }, "starboard: skipped (age-restricted or private channel)");
      return;
    }
    const board = await guild.channels.fetch(config.channelId!).catch(() => null);
    if (!board || !board.isTextBased() || !("send" in board)) {
      log.warn({ channelId: config.channelId }, "starboard: the channel is missing or the bot can't post in it");
      return;
    }

    // Count from Discord, fresh. Above 100 reactions the listing is capped, so use the reaction's own count.
    const fresh = message.reactions.cache.find((r) => isStarEmoji(config.emoji, { id: r.emoji.id, name: r.emoji.name }));
    const stars = fresh ? await countFor(fresh, message.author?.id ?? "", config.allowSelf) : 0;

    const existing = await findPost(message.id);
    const action = decide(stars, config.threshold, Boolean(existing?.boardMessageId));
    if (action === "none") {
      if (existing) await setStars(message.id, stars);
      return;
    }
    const view = starView(message, stars, config.emoji);
    const boardMessage = existing?.boardMessageId ? await board.messages.fetch(existing.boardMessageId).catch(() => null) : null;

    if (action === "remove") {
      if (boardMessage) await boardMessage.delete().catch((err) => log.warn({ err }, "starboard: could not delete the re-post"));
      await clearBoardMessage(message.id, stars);
      log.info({ message: message.id, stars }, "starboard: re-post removed (below the threshold)");
      return;
    }

    const payload = buildStarMessage(view);
    const data = { sourceChannelId: message.channelId, authorId: view.authorId, authorName: view.authorName, excerpt: truncate(view.content.replace(/\s+/g, " "), 200), jumpUrl: view.jumpUrl, stars };
    if (action === "update" && boardMessage) {
      await boardMessage.edit(payload);
      await upsertPost(message.id, data, boardMessage.id);
      log.info({ message: message.id, stars }, "starboard: count updated");
      return;
    }
    const posted = await board.send(payload); // "post", or "update" whose re-post was deleted by hand
    await upsertPost(message.id, data, posted.id);
    log.info({ message: message.id, stars, board: posted.id }, "starboard: posted");
  });
}

async function countFor(reaction: MessageReaction, authorId: string, allowSelf: boolean): Promise<number> {
  const ids = await reactors(reaction);
  const counted = countStars(ids, { authorId, allowSelf });
  // The listing is capped; for popular messages trust the reaction's total minus the people we know don't count.
  if (reaction.count > FETCH_LIMIT) return Math.max(counted, reaction.count - (reaction.me ? 1 : 0) - (!allowSelf && ids.includes(authorId) ? 1 : 0));
  return counted;
}

function starView(message: Message, stars: number, emoji: string) {
  const image = message.attachments.find((a) => a.contentType?.startsWith("image/") ?? false);
  return {
    emoji: medal(stars) === "\u2B50" ? emoji : medal(stars),
    stars,
    channelId: message.channelId,
    jumpUrl: message.url,
    authorId: message.author?.id ?? "0",
    authorName: message.member?.displayName ?? message.author?.username ?? "Unknown",
    content: message.content,
    imageUrl: safeImage(image?.url),
    attachmentCount: message.attachments.size,
    at: message.createdAt,
  };
}

/** The original was deleted: take its re-post down too, and forget the row. */
async function onDelete(message: Message | PartialMessage): Promise<void> {
  if (!message.guildId || message.guildId !== env().DISCORD_GUILD_ID) return;
  await mutex.run(message.id, async () => {
    const config = await getStarboardConfig();
    const existing = await findPost(message.id);
    if (existing?.boardMessageId && config.channelId) {
      const board = await message.guild?.channels.fetch(config.channelId).catch(() => null);
      if (board?.isTextBased()) await board.messages.delete(existing.boardMessageId).catch(() => undefined);
    }
    if (existing) {
      await deletePost(message.id);
      log.info({ message: message.id }, "starboard: original deleted, re-post removed");
    } else {
      // Somebody deleted the re-post itself: keep the row but forget the message, so the next star re-posts it.
      const asBoard = await findByBoardMessage(message.id);
      if (asBoard) await clearBoardMessage(asBoard.sourceMessageId, asBoard.stars);
    }
  });
}

/** Needs the GuildMessageReactions intent (not privileged) and partials for messages not in the cache. */
export function registerStarboard(client: Client): void {
  const guarded = (task: Promise<void>) => void task.catch((err) => log.error({ err }, "starboard handler failed"));
  client.on(Events.MessageReactionAdd, (reaction, user) => guarded(onReaction(reaction, user)));
  client.on(Events.MessageReactionRemove, (reaction, user) => guarded(onReaction(reaction, user)));
  client.on(Events.MessageDelete, (message) => guarded(onDelete(message)));
}
