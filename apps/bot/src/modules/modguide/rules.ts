import type { APIEmbed, RESTPostAPIChatInputApplicationCommandsJSONBody } from "discord.js";
import { withEmotes } from "../../lib/emotes";
import { escapeText, truncate } from "../../lib/escape";

// Pure part of the moderators' guide: which commands are listed, how a command's usage is written, and how
// the text is cut into Discord messages. Everything taken from a command definition is escaped; staff text
// keeps its markdown, and nothing here can ping (the message allows no mentions).

export type GuideCommand = { data: RESTPostAPIChatInputApplicationCommandsJSONBody; requires?: "admin" | "moderator" };

/** Commands that are team-only inside their own code (no `requires` on the definition) but belong in the guide. */
const TEAM_ONLY_IN_CODE = new Set(["ticket"]);
/** Left out on purpose: a health check says nothing worth guiding. */
const SKIPPED = new Set(["ping"]);

export const CATEGORIES = [
  { key: "members", title: "Acting on members", commands: ["warn", "timeout", "untimeout", "kick", "ban", "unban", "note"] },
  { key: "cases", title: "Cases and history", commands: ["case", "infractions"] },
  { key: "channels", title: "Channel tools", commands: ["purge", "slowmode", "lock", "unlock", "embed"] },
  { key: "community", title: "Community", commands: ["giveaway", "poll", "suggestion", "ticket"] },
] as const;
const OTHER_TITLE = "Other";

type Option = NonNullable<RESTPostAPIChatInputApplicationCommandsJSONBody["options"]>[number];

const SUBCOMMAND = 1;
const GROUP = 2;

function argUsage(options: readonly Option[]): string {
  return options
    .filter((o) => o.type !== SUBCOMMAND && o.type !== GROUP)
    .map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`))
    .join(" ");
}

/** "/ban <user> <reason> [duration]", or for sub-commands "/suggestion approve|deny|implement". */
export function usageOf(data: RESTPostAPIChatInputApplicationCommandsJSONBody): string {
  const options = (data.options ?? []) as Option[];
  const subs = options.filter((o) => o.type === SUBCOMMAND || o.type === GROUP);
  if (subs.length > 0) return `/${data.name} ${subs.map((s) => s.name).join("|")}`;
  const args = argUsage(options);
  return args ? `/${data.name} ${args}` : `/${data.name}`;
}

/** Whether a command is meant for moderators (not admin-only, not for everyone). */
export function isModeratorCommand(c: GuideCommand): boolean {
  if (SKIPPED.has(c.data.name)) return false;
  return c.requires === "moderator" || (c.requires === undefined && TEAM_ONLY_IN_CODE.has(c.data.name));
}

export type GuideCategory = { title: string; lines: string[] };

/** One entry per command: the usage in bold, then what it does. Categories keep the order above; strays go to "Other". */
export function buildCategories(commands: readonly GuideCommand[]): GuideCategory[] {
  const mine = commands.filter(isModeratorCommand);
  const byName = new Map(mine.map((c) => [c.data.name, c]));
  const used = new Set<string>();
  const line = (c: GuideCommand) => `**\`${usageOf(c.data)}\`**\n${truncate(escapeText(c.data.description), 110)}`;

  const result: GuideCategory[] = [];
  for (const cat of CATEGORIES) {
    const lines = cat.commands.flatMap((name) => {
      const c = byName.get(name);
      if (!c) return [];
      used.add(name);
      return [line(c)];
    });
    if (lines.length > 0) result.push({ title: cat.title, lines });
  }
  const rest = mine.filter((c) => !used.has(c.data.name)).sort((a, b) => a.data.name.localeCompare(b.data.name));
  if (rest.length > 0) result.push({ title: OTHER_TITLE, lines: rest.map(line) });
  return result;
}

export type GuideText = { title: string; description: string; imageUrl: string; color: string; notes: string };

const EMBED_TEXT_BUDGET = 5_500; // Discord counts all embeds of one message together against 6000
const MAX_EMBEDS = 10;
const DESCRIPTION_LIMIT = 4_000;

const colorNumber = (hex: string): number => (/^#[0-9a-fA-F]{6}$/.test(hex) ? parseInt(hex.slice(1), 16) : 0x00ffa8);

/** The cover embed, one embed per category and an optional notes embed, grouped into as few messages as fit. */
export function buildGuidePages(text: GuideText, categories: readonly GuideCategory[]): APIEmbed[][] {
  const color = colorNumber(text.color);
  const embeds: APIEmbed[] = [];
  const cover: APIEmbed = { title: truncate(withEmotes(text.title.trim() || "Moderator guide"), 256), color };
  if (text.description.trim()) cover.description = truncate(withEmotes(text.description.trim()), 1500);
  if (text.imageUrl.startsWith("https://")) cover.image = { url: text.imageUrl };
  embeds.push(cover);

  for (const cat of categories) {
    chunkDescription(cat.lines).forEach((chunk, n) => embeds.push({ title: n === 0 ? cat.title : `${cat.title} (continued)`, description: chunk, color }));
  }
  if (text.notes.trim()) embeds.push({ title: "Good to know", description: truncate(withEmotes(text.notes.trim()), 1500), color });

  const size = (e: APIEmbed) => (e.title?.length ?? 0) + (e.description?.length ?? 0);
  const pages: APIEmbed[][] = [];
  let page: APIEmbed[] = [];
  let used = 0;
  for (const e of embeds) {
    if (page.length > 0 && (page.length >= MAX_EMBEDS || used + size(e) > EMBED_TEXT_BUDGET)) {
      pages.push(page);
      page = [];
      used = 0;
    }
    page.push(e);
    used += size(e);
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

function chunkDescription(lines: readonly string[]): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const l of lines) {
    if (current && current.length + l.length + 2 > DESCRIPTION_LIMIT) {
      chunks.push(current);
      current = "";
    }
    current += (current ? "\n\n" : "") + l;
  }
  if (current) chunks.push(current);
  return chunks;
}
