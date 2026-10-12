import { Events, type Client } from "discord.js";
import { env } from "./env";
import { log } from "./log";

// The server's own custom emotes in text the bot posts. Staff (and members, where their text is shown) can write an emote either
// as Discord's own markup, <:name:id> or <a:name:id> (the dashboard's emote picker inserts that), or as a shortcode like :name:.
// Both become the real emote, but ONLY if it is one of this server's emotes: markup for an emote that isn't here (or an id
// somebody made up) stays plain text. Everything around an emote is treated exactly as before (escaped where it was escaped).
// The list lives in memory, filled when the bot connects and kept current by Discord's emoji events.

type Emote = { id: string; name: string; animated: boolean };

let byId = new Map<string, Emote>();
let byName = new Map<string, Emote>();

/** Replaces the known emotes (used by the loader and by tests). */
export function setEmotes(list: readonly Emote[]): void {
  byId = new Map(list.map((e) => [e.id, e]));
  byName = new Map();
  // The first emote of a name wins, so a shortcode is stable even if two emotes share a name in different case.
  for (const e of list) if (!byName.has(e.name.toLowerCase())) byName.set(e.name.toLowerCase(), e);
}

const markup = (e: Emote) => `<${e.animated ? "a" : ""}:${e.name}:${e.id}>`;

// <a:name:id> / <:name:id>, or :name:. Names are 2-32 word characters (Discord's rule).
const TOKEN = /<(a?):(\w{2,32}):(\d{17,20})>|:(\w{2,32}):/g;

/**
 * Walks the text: each real emote becomes its markup, everything else (including markup or a :shortcode: that is not one of
 * this server's emotes) is handed to `plain` as ordinary text.
 */
export function mapEmotes(text: string, plain: (segment: string) => string): string {
  if (byId.size === 0 || !text.includes(":")) return plain(text);
  let out = "";
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const emote = m[3] ? byId.get(m[3]) : byName.get((m[4] ?? "").toLowerCase());
    if (!emote) continue; // not ours: it stays part of the surrounding plain text
    out += plain(text.slice(last, m.index)) + markup(emote);
    last = m.index + m[0].length;
  }
  return out + plain(text.slice(last));
}

/** Staff text that keeps its markdown: only the emotes are made real. */
export const withEmotes = (text: string): string => mapEmotes(text, (s) => s);

async function load(client: Client): Promise<void> {
  const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
  if (!guild) return;
  const fetched = await guild.emojis.fetch();
  setEmotes([...fetched.values()].filter((e) => e.id && e.name && e.available !== false).map((e) => ({ id: e.id, name: e.name!, animated: e.animated ?? false })));
  log.info({ emotes: byId.size }, "emotes: loaded the server's emotes");
}

/** Keeps the emote list in step with the server. */
export function startEmotes(client: Client): void {
  const refresh = () => void load(client).catch((err) => log.warn({ err }, "emotes: could not load the server's emotes"));
  client.once(Events.ClientReady, refresh);
  client.on(Events.GuildEmojiCreate, (e) => e.guild.id === env().DISCORD_GUILD_ID && refresh());
  client.on(Events.GuildEmojiDelete, (e) => e.guild.id === env().DISCORD_GUILD_ID && refresh());
  client.on(Events.GuildEmojiUpdate, (_, e) => e.guild.id === env().DISCORD_GUILD_ID && refresh());
}
