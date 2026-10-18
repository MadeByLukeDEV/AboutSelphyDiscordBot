import { EmbedBuilder } from "discord.js";
import type { MemberOverviewPayload } from "@aboutselphy/shared/memberoverview";
import { truncate } from "../../lib/escape";

// Pure part of the member overview: turns the text the dashboard sends into embeds and packs them into as few messages as
// Discord allows (10 embeds and about 6000 characters per message, 25 fields and 1024 characters per field). The text is
// ours (built from the dashboard's catalogs) and the messages allow no mentions, so nothing here can ping.

export const MAX_EMBEDS = 10;
export const TEXT_BUDGET = 5_500;
const FIELD_LIMIT = 1_024;

const colorNumber = (hex: string): number => (/^#[0-9a-fA-F]{6}$/.test(hex) ? Number.parseInt(hex.slice(1), 16) : 0x00ffa8);

/** An item's field value: its text, then its commands in code style (the text is cut so the whole value fits). */
export function itemValue(body: string, commands: readonly string[]): string {
  const cmds = commands.length > 0 ? `\n${commands.map((c) => `\`${c}\``).join(" ")}` : "";
  return truncate(body, Math.max(40, FIELD_LIMIT - cmds.length)) + cmds;
}

type Built = { embed: EmbedBuilder; size: number };

/** One embed per group, plus a header embed first; the footer text goes on the last one. */
export function buildEmbeds(payload: MemberOverviewPayload, color: string): Built[] {
  const c = colorNumber(color);
  const built: Built[] = [];
  const head = new EmbedBuilder().setColor(c).setTitle(payload.title).setDescription(payload.intro);
  if (payload.url) head.setURL(payload.url);
  built.push({ embed: head, size: payload.title.length + payload.intro.length });

  for (const g of payload.groups) {
    const e = new EmbedBuilder().setColor(c).setTitle(g.title);
    let size = g.title.length;
    if (g.intro) {
      e.setDescription(g.intro);
      size += g.intro.length;
    }
    for (const item of g.items.slice(0, 25)) {
      const value = itemValue(item.body, item.commands);
      e.addFields({ name: truncate(item.title, 256), value });
      size += item.title.length + value.length;
    }
    built.push({ embed: e, size });
  }
  if (payload.footer) {
    const last = built[built.length - 1]!;
    last.embed.setFooter({ text: truncate(payload.footer, 200) });
    last.size += payload.footer.length;
  }
  return built;
}

/** Packs the embeds in order into messages that stay inside Discord's per-message limits. */
export function packPages(built: readonly Built[]): EmbedBuilder[][] {
  const pages: EmbedBuilder[][] = [];
  let current: EmbedBuilder[] = [];
  let used = 0;
  for (const b of built) {
    if (current.length > 0 && (current.length >= MAX_EMBEDS || used + b.size > TEXT_BUDGET)) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(b.embed);
    used += b.size;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

export const overviewPages = (payload: MemberOverviewPayload, color: string): EmbedBuilder[][] => packPages(buildEmbeds(payload, color));
