import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { GIVEAWAY_COLOR } from "@aboutselphy/shared/giveaways";
import { escapeText, truncate } from "../../lib/escape";

// The parts of giveaways that need no Discord connection and no database: picking winners, the
// message and its button, and the control id. Pure, so the rules are testable.

/**
 * `count` different winners from `candidates`, uniformly at random (a partial Fisher-Yates shuffle,
 * so nobody is favoured). `random` is injected for tests. Fewer candidates than `count` = all of them.
 */
export function pickWinners(candidates: string[], count: number, random: () => number = Math.random): string[] {
  const pool = [...new Set(candidates)];
  const n = Math.min(Math.max(0, Math.floor(count)), pool.length);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, n);
}

// -- control id: "gw:enter:<id>" -----------------------------------------------------------------------

export const GIVEAWAY_PREFIX = "gw";
export const enterControlId = (id: string) => `${GIVEAWAY_PREFIX}:enter:${id}`;

/** Strict parse: only our own shape with an id-looking part. */
export function parseEnterControl(customId: string): string | null {
  return /^gw:enter:([a-z0-9]{10,40})$/.exec(customId)?.[1] ?? null;
}

// -- the message -------------------------------------------------------------------------------------------

export type GiveawayView = {
  id: string;
  prize: string;
  description: string;
  winnerCount: number;
  endsAt: Date;
  hostName: string;
  requiredRoleId: string | null;
  ended: boolean;
  /** Only for an ended giveaway. */
  winners: string[];
  entryCount?: number;
};

/** The giveaway post: staff-written prize and text are escaped (they can't ping or link), winners are real mentions. */
export function buildGiveawayMessage(g: GiveawayView) {
  const embed = new EmbedBuilder()
    .setColor(g.ended ? 0x6b7280 : GIVEAWAY_COLOR)
    .setTitle(`🎉 ${truncate(escapeText(g.prize), 240)}`)
    .setFooter({ text: `Hosted by ${truncate(g.hostName, 60)}` });
  const lines: string[] = [];
  if (g.description) lines.push(truncate(escapeText(g.description), 900));
  if (g.ended) {
    lines.push(g.winners.length ? `**Winner${g.winners.length === 1 ? "" : "s"}:** ${g.winners.map((id) => `<@${id}>`).join(", ")}` : "**No valid entries, so nobody won.**");
    lines.push(`Ended <t:${Math.floor(g.endsAt.getTime() / 1000)}:R>`);
  } else {
    lines.push(`Press the button to enter.\nEnds <t:${Math.floor(g.endsAt.getTime() / 1000)}:R> (<t:${Math.floor(g.endsAt.getTime() / 1000)}:f>)`);
    lines.push(`**Winners:** ${g.winnerCount}`);
    if (g.requiredRoleId) lines.push(`**You need:** <@&${g.requiredRoleId}>`);
  }
  if (g.entryCount !== undefined) lines.push(`**Entries:** ${g.entryCount}`);
  embed.setDescription(lines.join("\n\n"));

  const button = new ButtonBuilder().setCustomId(enterControlId(g.id)).setLabel(g.ended ? "Ended" : "Enter").setEmoji("🎉").setStyle(ButtonStyle.Primary).setDisabled(g.ended);
  return {
    content: "",
    embeds: [embed],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(button)],
    // Nothing typed into a giveaway can ping anyone; winners are announced separately.
    allowedMentions: { parse: [] as never[] },
  };
}

/** The follow-up that pings the winners (and only them). */
export function winnerAnnouncement(prize: string, winners: string[], reroll: boolean) {
  const mentions = winners.map((id) => `<@${id}>`).join(", ");
  return {
    content: truncate(winners.length ? `🎉 ${reroll ? "New winner" : "Congratulations"}${winners.length === 1 ? "" : "s"}: ${mentions}! You won **${escapeText(prize)}**.` : `No valid entries for **${escapeText(prize)}**, so nobody won.`, 2000),
    allowedMentions: { parse: [] as never[], users: winners },
  };
}
