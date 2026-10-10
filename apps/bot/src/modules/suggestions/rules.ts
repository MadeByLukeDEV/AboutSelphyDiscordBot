import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { SuggestionStatusName } from "@aboutselphy/shared/suggestions";
import { escapeText, truncate } from "../../lib/escape";

// The suggestion post and its vote buttons. Pure, so the rules are testable. The text a member
// wrote is escaped (it can't ping or link) and the author is shown as a mention plus their name.

export const SUGGESTION_PREFIX = "sg";
export type VoteValue = 1 | -1;
export const voteControlId = (id: string, value: VoteValue) => `${SUGGESTION_PREFIX}:${value === 1 ? "up" : "down"}:${id}`;

/** Strict parse: only our own shapes with an id-looking part. */
export function parseVoteControl(customId: string): { id: string; value: VoteValue } | null {
  const match = /^sg:(up|down):([a-z0-9]{10,40})$/.exec(customId);
  return match ? { id: match[2]!, value: match[1] === "up" ? 1 : -1 } : null;
}

const COLORS: Record<SuggestionStatusName, number> = { open: 0x3498db, approved: 0x2ecc71, denied: 0xe74c3c, implemented: 0x00ffa8 };
const LABELS: Record<SuggestionStatusName, string> = { open: "Open", approved: "Approved", denied: "Denied", implemented: "Implemented" };

export type SuggestionView = {
  id: string;
  number: number;
  authorId: string;
  authorName: string;
  content: string;
  status: SuggestionStatusName;
  up: number;
  down: number;
  decidedByName: string | null;
  decisionReason: string;
};

export function buildSuggestionMessage(s: SuggestionView) {
  const embed = new EmbedBuilder()
    .setColor(COLORS[s.status])
    .setTitle(`Suggestion #${s.number}`)
    .setDescription(truncate(escapeText(s.content), 4000))
    .addFields({ name: "Suggested by", value: `<@${s.authorId}> (${escapeText(truncate(s.authorName, 60))})`, inline: true }, { name: "Status", value: LABELS[s.status], inline: true });
  if (s.status !== "open") {
    embed.addFields({ name: `${LABELS[s.status]} by`, value: escapeText(s.decidedByName ?? "the team"), inline: true });
    if (s.decisionReason) embed.addFields({ name: "Reason", value: truncate(escapeText(s.decisionReason), 1000) });
  }
  embed.setFooter({ text: `👍 ${s.up}   👎 ${s.down}` });

  const decided = s.status !== "open";
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(voteControlId(s.id, 1)).setLabel(String(s.up)).setEmoji("👍").setStyle(ButtonStyle.Secondary).setDisabled(decided),
    new ButtonBuilder().setCustomId(voteControlId(s.id, -1)).setLabel(String(s.down)).setEmoji("👎").setStyle(ButtonStyle.Secondary).setDisabled(decided),
  );
  return { content: "", embeds: [embed], components: [row], allowedMentions: { parse: [] as never[] } };
}

/**
 * What pressing a vote button means: a new vote, taking the same vote back, or switching sides.
 * `current` is what the member voted before (null = nothing).
 */
export function nextVote(current: VoteValue | null, pressed: VoteValue): VoteValue | null {
  return current === pressed ? null : pressed;
}

/** Has the member waited long enough since their last suggestion? */
export function cooldownRemaining(lastAt: Date | null, now: Date, cooldownSeconds: number): number {
  if (!lastAt || cooldownSeconds <= 0) return 0;
  return Math.max(0, Math.ceil((lastAt.getTime() + cooldownSeconds * 1000 - now.getTime()) / 1000));
}
