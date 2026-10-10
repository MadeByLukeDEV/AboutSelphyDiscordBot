import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";

// The poll post, its vote buttons, and what a press means. Pure, so the rules are testable. The
// question and options are escaped (they can't ping or link) and votes are anonymous: only counts
// are ever shown.

export const POLL_PREFIX = "pl";
export const voteControlId = (id: string, index: number) => `${POLL_PREFIX}:v:${id}:${index}`;

/** Strict parse: only our own shape with an id-looking part and an option number 0 to 9. */
export function parseVoteControl(customId: string): { id: string; index: number } | null {
  const match = /^pl:v:([a-z0-9]{10,40}):([0-9])$/.exec(customId);
  return match ? { id: match[1]!, index: Number(match[2]) } : null;
}

/**
 * What the member's choices become when they press option `pressed`. A single-choice poll replaces
 * the choice (pressing the chosen option again withdraws it); a multiple-choice poll toggles that one.
 */
export function nextSelection(current: ReadonlySet<number>, pressed: number, multiple: boolean): Set<number> {
  const next = new Set(current);
  if (current.has(pressed)) {
    next.delete(pressed);
    return next;
  }
  if (!multiple) next.clear();
  next.add(pressed);
  return next;
}

/** Counts per option, from the raw votes. */
export function tally(optionCount: number, votes: Array<{ optionIndex: number }>): number[] {
  const counts = new Array<number>(optionCount).fill(0);
  for (const v of votes) if (v.optionIndex >= 0 && v.optionIndex < optionCount) counts[v.optionIndex]!++;
  return counts;
}

const BAR_CELLS = 12;
/** "████░░░░░░░░" for a share. */
export function bar(count: number, total: number): string {
  const filled = total === 0 ? 0 : Math.round((count / total) * BAR_CELLS);
  return "█".repeat(filled) + "░".repeat(BAR_CELLS - filled);
}

export type PollView = {
  id: string;
  question: string;
  options: string[];
  multiple: boolean;
  endsAt: Date | null;
  ended: boolean;
  counts: number[];
  /** How many different members voted (not the number of votes: a multiple-choice voter counts once). */
  voters: number;
  createdByName: string;
};

export function buildPollMessage(p: PollView) {
  const total = p.counts.reduce((a, b) => a + b, 0);
  const top = Math.max(...p.counts);
  const lines = p.options.map((option, i) => {
    const count = p.counts[i] ?? 0;
    const percent = total === 0 ? 0 : Math.round((count / total) * 100);
    const winner = p.ended && count === top && top > 0 ? " 🏆" : "";
    return `**${i + 1}.** ${truncate(escapeText(option), 90)}${winner}\n${bar(count, total)} ${count} (${percent}%)`;
  });
  const status = p.ended
    ? "**This poll has ended.**"
    : `${p.multiple ? "You can choose several options." : "Choose one option."} Press a button to vote, press it again to withdraw.${p.endsAt ? `\nEnds <t:${Math.floor(p.endsAt.getTime() / 1000)}:R>` : ""}`;

  const embed = new EmbedBuilder()
    .setColor(p.ended ? 0x6b7280 : 0x00ffa8)
    .setTitle(`📊 ${truncate(escapeText(p.question), 250)}`)
    .setDescription(`${lines.join("\n\n")}\n\n${status}`)
    .setFooter({ text: `${p.voters} ${p.voters === 1 ? "voter" : "voters"} · by ${truncate(p.createdByName, 40)}` });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let start = 0; start < p.options.length; start += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        p.options.slice(start, start + 5).map((option, offset) =>
          new ButtonBuilder()
            .setCustomId(voteControlId(p.id, start + offset))
            .setLabel(truncate(`${start + offset + 1}. ${option}`, 80))
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(p.ended),
        ),
      ),
    );
  }
  return { content: "", embeds: [embed], components: rows, allowedMentions: { parse: [] as never[] } };
}
