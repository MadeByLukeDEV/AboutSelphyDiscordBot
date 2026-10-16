import { isAllowedImageUrl } from "@aboutselphy/shared/announcement";
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

export type Candidate = { id: string; weight: number };

/**
 * Like pickWinners, but a candidate with weight 3 is three times as likely as one with weight 1 at every step (a weighted draw
 * without replacement: once someone wins they are out). Nobody wins twice, weights below 1 count as 1, and equal weights behave
 * exactly like the plain draw. `random` is injected for tests.
 */
export function pickWeightedWinners(candidates: Candidate[], count: number, random: () => number = Math.random): string[] {
  const pool = new Map<string, number>();
  for (const c of candidates) pool.set(c.id, Math.max(pool.get(c.id) ?? 0, Math.max(1, Math.floor(c.weight))));
  const winners: string[] = [];
  const n = Math.min(Math.max(0, Math.floor(count)), pool.size);
  while (winners.length < n) {
    const total = [...pool.values()].reduce((a, b) => a + b, 0);
    let ticket = random() * total;
    let chosen: string | undefined;
    for (const [id, weight] of pool) {
      chosen = id;
      if ((ticket -= weight) < 0) break;
    }
    if (chosen === undefined) break;
    winners.push(chosen);
    pool.delete(chosen);
  }
  return winners;
}

/** One person's number of tickets: 1, plus the bonus if they hold the bonus role. */
export const ticketsFor = (hasBonusRole: boolean, bonusEntries: number): number => 1 + (hasBonusRole ? Math.max(0, Math.floor(bonusEntries)) : 0);

// -- control id: "gw:enter:<id>" -----------------------------------------------------------------------

export const GIVEAWAY_PREFIX = "gw";
export const enterControlId = (id: string) => `${GIVEAWAY_PREFIX}:enter:${id}`;

/** Strict parse: only our own shape with an id-looking part. */
export function parseEnterControl(customId: string): string | null {
  return /^gw:enter:([a-z0-9]{10,40})$/.exec(customId)?.[1] ?? null;
}

// -- the message -------------------------------------------------------------------------------------------

// -- entry requirements ---------------------------------------------------------------------------------

const DAY_MS = 86_400_000;

export type Requirements = { minAccountDays: number; minMemberDays: number; minLevel: number; requireTwitch?: boolean };
export type Candidate_ = { accountCreatedAt: Date; joinedAt: Date | null; level: number; twitchLinked?: boolean };

/** The first requirement a member misses, or null when they meet them all. */
export function entryProblem(req: Requirements, who: Candidate_, now: Date): { kind: "account" | "member" | "level" | "twitch"; need: number } | null {
  if (req.minAccountDays > 0 && now.getTime() - who.accountCreatedAt.getTime() < req.minAccountDays * DAY_MS) return { kind: "account", need: req.minAccountDays };
  // Without a known join time the member can't show how long they have been here: they don't meet a time-in-server rule.
  if (req.minMemberDays > 0 && (!who.joinedAt || now.getTime() - who.joinedAt.getTime() < req.minMemberDays * DAY_MS)) return { kind: "member", need: req.minMemberDays };
  if (req.minLevel > 0 && who.level < req.minLevel) return { kind: "level", need: req.minLevel };
  if (req.requireTwitch && !who.twitchLinked) return { kind: "twitch", need: 1 };
  return null;
}

/** What a member who misses a requirement is told. */
export function problemText(p: { kind: "account" | "member" | "level" | "twitch"; need: number }): string {
  if (p.kind === "twitch") return "You need a confirmed Twitch link to enter this giveaway. Use /vip link to link your Twitch account.";
  if (p.kind === "account") return `Your Discord account must be at least ${p.need} ${p.need === 1 ? "day" : "days"} old to enter this giveaway.`;
  if (p.kind === "member") return `You must have been in this server for at least ${p.need} ${p.need === 1 ? "day" : "days"} to enter this giveaway.`;
  return `You need to be at least level ${p.need} to enter this giveaway.`;
}

/** The "Requirements" lines for the post. */
export function requirementLines(req: Requirements): string[] {
  const lines: string[] = [];
  if (req.minAccountDays > 0) lines.push(`Discord account at least ${req.minAccountDays} ${req.minAccountDays === 1 ? "day" : "days"} old`);
  if (req.minMemberDays > 0) lines.push(`In this server for at least ${req.minMemberDays} ${req.minMemberDays === 1 ? "day" : "days"}`);
  if (req.minLevel > 0) lines.push(`Level ${req.minLevel} or higher`);
  if (req.requireTwitch) lines.push("A linked Twitch account (/vip link)");
  return lines;
}

// -- repeating --------------------------------------------------------------------------------------------

const MIN_ROUND_MS = 5 * 60_000;

/** When the next round of a repeating giveaway ends: as long after `now` as the finished round lasted (at least five minutes). */
export function nextRoundEnd(startedAt: Date | null, endsAt: Date, now: Date): Date {
  const length = startedAt ? endsAt.getTime() - startedAt.getTime() : 0;
  return new Date(now.getTime() + Math.max(MIN_ROUND_MS, length));
}

export type GiveawayView = {
  id: string;
  prize: string;
  description: string;
  winnerCount: number;
  endsAt: Date;
  hostName: string;
  requiredRoleId: string | null;
  /** A role whose members get extra chances (shown in the post). */
  bonusRoleId?: string | null;
  bonusEntries?: number;
  /** Requirements beyond the role, listed in the post. */
  requirements?: Requirements;
  ended: boolean;
  /** Only for an ended giveaway. */
  winners: string[];
  entryCount?: number;
  /** Optional picture; only https addresses are ever shown. */
  imageUrl?: string;
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
    const reqs = g.requirements ? requirementLines(g.requirements) : [];
    if (reqs.length > 0) lines.push(`**Requirements:** ${reqs.join(" · ")}`);
    if (g.bonusRoleId && g.bonusEntries) lines.push(`**Bonus:** <@&${g.bonusRoleId}> members get ${g.bonusEntries} extra ${g.bonusEntries === 1 ? "chance" : "chances"}.`);
  }
  if (g.entryCount !== undefined) lines.push(`**Entries:** ${g.entryCount}`);
  embed.setDescription(lines.join("\n\n"));
  if (g.imageUrl && isAllowedImageUrl(g.imageUrl)) embed.setImage(g.imageUrl);

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
