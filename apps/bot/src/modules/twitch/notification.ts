import { EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";

// The announcement message. Everything Twitch or staff typed (title, game,
// display name, the template) is user-controlled: escaped, with mentions
// blocked by allowedMentions at send time, so none of it can ping or link.

const TWITCH_PURPLE = 0x9146ff;
const ENDED_GREY = 0x6b7280;

export type StreamView = {
  login: string;
  displayName: string;
  title: string;
  game: string;
  startedAt: Date;
  /** Twitch's preview URL with {width}x{height} placeholders, or "". */
  thumbnailUrl: string;
};

export function channelUrl(login: string): string {
  return `https://twitch.tv/${encodeURIComponent(login)}`;
}

/** Twitch's thumbnail template to a real size, cache-busted so Discord doesn't show a stale frame. */
export function thumbnail(template: string, bust: number): string | undefined {
  if (!template) return undefined;
  const url = template.replace("{width}", "1280").replace("{height}", "720");
  // Only Twitch's own CDN is ever put in an embed.
  if (!/^https:\/\/[a-z0-9-]+\.(?:jtvnw\.net|twitch\.tv)\//i.test(url)) return undefined;
  return `${url}${url.includes("?") ? "&" : "?"}t=${bust}`;
}

/** {name} {title} {game} {url} in the staff template; all values escaped, unknown placeholders left as they are. */
export function renderTemplate(template: string, stream: StreamView): string {
  const values: Record<string, string> = {
    name: escapeText(stream.displayName),
    title: escapeText(stream.title) || "a new stream",
    game: escapeText(stream.game) || "something fun",
    url: channelUrl(stream.login),
  };
  return template.replace(/\{(name|title|game|url)\}/g, (_, key: string) => values[key] ?? "");
}

export function liveMessage(stream: StreamView, template: string, pingRoleId: string | null, now = Date.now()) {
  const ping = pingRoleId ? `<@&${pingRoleId}> ` : "";
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setAuthor({ name: `${stream.displayName} is live on Twitch` })
    .setTitle(truncate(stream.title || "Live now", 256))
    .setURL(channelUrl(stream.login))
    .setTimestamp(stream.startedAt);
  if (stream.game) embed.addFields({ name: "Playing", value: truncate(stream.game, 256), inline: true });
  const image = thumbnail(stream.thumbnailUrl, Math.floor(now / 60_000));
  if (image) embed.setImage(image);
  return {
    content: truncate(`${ping}${renderTemplate(template, stream)}`, 2000),
    embeds: [embed],
    // Only the one configured role can be pinged; nothing from the template can.
    allowedMentions: pingRoleId ? { parse: [] as never[], roles: [pingRoleId] } : { parse: [] as never[] },
  };
}

/** The same message after the stream ended: grey, no preview, no ping, no link bait. */
export function endedMessage(stream: StreamView, endedAt: Date) {
  const embed = new EmbedBuilder()
    .setColor(ENDED_GREY)
    .setAuthor({ name: `${stream.displayName} was live on Twitch` })
    .setTitle(truncate(stream.title || "Stream ended", 256))
    .setURL(channelUrl(stream.login))
    .setDescription(`Stream ended <t:${Math.floor(endedAt.getTime() / 1000)}:R>.`)
    .setTimestamp(stream.startedAt);
  if (stream.game) embed.addFields({ name: "Played", value: truncate(stream.game, 256), inline: true });
  return { content: "", embeds: [embed], allowedMentions: { parse: [] as never[] } };
}
