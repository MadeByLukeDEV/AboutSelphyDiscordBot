import type { Guild, GuildTextBasedChannel } from "discord.js";
import type { Suggestion } from "@aboutselphy/db";
import type { SuggestionDecideStatus, SuggestionMergeStatus } from "@aboutselphy/shared";
import { canTransition, MAX_SUGGESTION, type Decision } from "@aboutselphy/shared/suggestions";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { getSuggestionConfig } from "./config";
import { copyVotes, counts, create, decide, find, findByNumber, lastCreatedAt, reserveNumber, setMergedInto } from "./repository";
import { buildSuggestionMessage, cooldownRemaining, type SuggestionView } from "./rules";

const toView = async (s: Suggestion): Promise<SuggestionView> => ({
  id: s.id,
  number: s.number,
  authorId: s.authorId,
  authorName: s.authorName,
  content: s.content,
  status: s.status,
  ...(await counts(s.id)),
  decidedByName: s.decidedByName,
  decisionReason: s.decisionReason,
});

async function channelOf(guild: Guild, id: string): Promise<GuildTextBasedChannel | null> {
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === env().DISCORD_GUILD_ID && channel.isTextBased() && "send" in channel ? (channel as GuildTextBasedChannel) : null;
}

export type SubmitResult = { ok: true; number: number; channelId: string; messageId: string } | { ok: false; message: string };

/** A member's /suggest. Checks the switch, the channel and the cooldown, then posts and records it. */
export async function submitSuggestion(guild: Guild, author: { id: string; name: string }, rawContent: string): Promise<SubmitResult> {
  const config = await getSuggestionConfig();
  if (!config.enabled || !config.channelId) return { ok: false, message: "Suggestions aren't open right now." };
  const content = rawContent.replace(/\s+/g, " ").trim();
  if (content.length < 5) return { ok: false, message: "That's too short. Describe your idea in a sentence or two." };
  if (content.length > MAX_SUGGESTION) return { ok: false, message: `Please keep it under ${MAX_SUGGESTION} characters.` };

  const wait = cooldownRemaining(await lastCreatedAt(author.id), new Date(), config.cooldownSeconds);
  if (wait > 0) return { ok: false, message: `Please wait ${wait} more second${wait === 1 ? "" : "s"} before the next suggestion.` };

  const channel = await channelOf(guild, config.channelId);
  if (!channel) {
    log.warn({ channelId: config.channelId }, "suggestions: the channel is missing or not a text channel");
    return { ok: false, message: "I can't post in the suggestions channel right now. Please tell a moderator." };
  }

  const number = await reserveNumber();
  const view = { id: "pending", number, authorId: author.id, authorName: author.name, content, status: "open" as const, up: 0, down: 0, decidedByName: null, decisionReason: "" };
  // The vote buttons need the suggestion's id, so post first with a placeholder, then store and fix the buttons.
  const message = await channel.send({ ...buildSuggestionMessage(view), components: [] });
  try {
    const saved = await create({ number, authorId: author.id, authorName: author.name, content, channelId: channel.id, messageId: message.id });
    await message.edit(buildSuggestionMessage(await toView(saved)));
    log.info({ number, author: author.id, channelId: channel.id }, "suggestion posted");
    return { ok: true, number, channelId: channel.id, messageId: message.id };
  } catch (err) {
    log.error({ err, number }, "recording a suggestion failed");
    await message.delete().catch(() => undefined);
    return { ok: false, message: "Something went wrong saving your suggestion. Please try again." };
  }
}

// Votes change the counts on the post; editing it for every click would hit Discord's limits, so
// edits for the same suggestion are collected for a moment.
const pending = new Map<string, ReturnType<typeof setTimeout>>();
const EDIT_DELAY_MS = 1500;

export function refreshSoon(guild: Guild, id: string): void {
  if (pending.has(id)) return;
  pending.set(
    id,
    setTimeout(() => {
      pending.delete(id);
      void refreshNow(guild, id).catch((err) => log.warn({ err, suggestion: id }, "could not refresh a suggestion post"));
    }, EDIT_DELAY_MS),
  );
}

export async function refreshNow(guild: Guild, id: string): Promise<void> {
  const s = await find(id);
  if (!s) return;
  const channel = await channelOf(guild, s.channelId);
  const message = channel ? await channel.messages.fetch(s.messageId).catch(() => null) : null;
  if (message) await message.edit(buildSuggestionMessage(await toView(s)));
}

/**
 * Approves, denies or marks a suggestion implemented, with an optional reason. One conditional update
 * decides it, so two team members acting at once can't both apply. `by.id` is null for the dashboard.
 */
export async function decideSuggestion(guild: Guild, id: string, status: Decision, reason: string, by: { id: string | null; name: string }): Promise<SuggestionDecideStatus> {
  try {
    const s = await find(id);
    if (!s) return "not-found";
    if (!canTransition(s.status, status)) return "wrong-state";
    const from = status === "implemented" ? (["open", "approved"] as const) : (["open"] as const);
    if (!(await decide(id, [...from], status, by, reason))) return "wrong-state";
    await refreshNow(guild, id);
    // Tell the author (best effort): a decision on their idea is worth a message.
    const author = await guild.members.fetch(s.authorId).catch(() => null);
    if (author) {
      await author.send({ content: `Your suggestion #${s.number} was **${status}**${reason ? `: ${reason.slice(0, 300)}` : "."}`, allowedMentions: { parse: [] } }).catch(() => undefined);
    }
    log.info({ suggestion: s.number, status, by: by.id ?? by.name }, "suggestion decided");
    return "done";
  } catch (err) {
    log.error({ err, suggestion: id }, "deciding a suggestion failed");
    return "failed";
  }
}

/**
 * Closes `id` as a duplicate of suggestion #`targetNumber`: it is denied with a "Duplicate of #N" reason (through the normal
 * decision, so the post is edited and the author told), and its votes are copied to the target for members who hadn't
 * voted there. Only an open suggestion can be merged, into one that is not denied.
 */
export async function mergeSuggestion(guild: Guild, id: string, targetNumber: number, by: { id: string | null; name: string }): Promise<SuggestionMergeStatus> {
  try {
    const dup = await find(id);
    if (!dup) return "not-found";
    const target = await findByNumber(targetNumber);
    if (!target) return "target-not-found";
    if (target.id === dup.id) return "same";
    if (dup.status !== "open" || target.status === "denied") return "wrong-state";
    const decided = await decideSuggestion(guild, dup.id, "denied", `Duplicate of #${target.number}`, by);
    if (decided !== "done") return decided === "not-found" ? "not-found" : decided === "wrong-state" ? "wrong-state" : "failed";
    const moved = await copyVotes(dup.id, target.id);
    await setMergedInto(dup.id, target.number);
    await refreshNow(guild, target.id).catch((err) => log.warn({ err, suggestion: target.id }, "could not refresh the merge target"));
    log.info({ suggestion: dup.number, into: target.number, movedVotes: moved, by: by.id ?? by.name }, "suggestion merged");
    return "done";
  } catch (err) {
    log.error({ err, suggestion: id }, "merging a suggestion failed");
    return "failed";
  }
}
