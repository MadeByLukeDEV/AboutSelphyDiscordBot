import { withEmotes } from "../../lib/emotes";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";

// The announcement for a new video. Titles and channel names come from YouTube and
// are escaped; staff's template is kept as written. Only the one configured role can
// be pinged. The picture is only taken from YouTube's own image hosts.

export type VideoView = { videoId: string; title: string; channelTitle: string; publishedAt: Date; thumbnailUrl: string | null; scheduledStart?: Date | null };

export const videoUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

export function safeThumbnail(url: string | null): string | undefined {
  return url && /^https:\/\/(?:i|i9)\.ytimg\.com\//i.test(url) ? url : undefined;
}

/** {title} {channel} {url} {time} in the template; the title and channel are escaped, {time} is a relative Discord time of the scheduled start. */
export function renderTemplate(template: string, video: VideoView): string {
  const start = video.scheduledStart && !Number.isNaN(video.scheduledStart.getTime()) ? `<t:${Math.floor(video.scheduledStart.getTime() / 1000)}:R>` : "";
  const values: Record<string, string> = { title: escapeText(video.title), channel: escapeText(video.channelTitle), url: videoUrl(video.videoId), time: start };
  return withEmotes(template.replace(/\{(title|channel|url|time)\}/g, (_, key: string) => values[key] ?? ""));
}

/** The "Watch" link button under an announcement. A link button needs no handler: Discord opens the address. */
export function watchRow(videoId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setLabel("Watch").setEmoji("▶").setStyle(ButtonStyle.Link).setURL(videoUrl(videoId)));
}

export function videoMessage(video: VideoView, template: string, pingRoleId: string | null, color: number, watchButton = false) {
  const ping = pingRoleId ? `<@&${pingRoleId}> ` : "";
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(truncate(video.title, 256))
    .setURL(videoUrl(video.videoId))
    .setTimestamp(video.publishedAt);
  if (video.channelTitle) embed.setAuthor({ name: truncate(video.channelTitle, 256) });
  const image = safeThumbnail(video.thumbnailUrl);
  if (image) embed.setImage(image);
  return {
    content: truncate(`${ping}${renderTemplate(template, video)}`, 2000),
    embeds: [embed],
    components: watchButton ? [watchRow(video.videoId)] : [],
    allowedMentions: pingRoleId ? { parse: [] as never[], roles: [pingRoleId] } : { parse: [] as never[] },
  };
}

/** The announcement for an upcoming premiere/broadcast: the same message, with the start time on the embed. */
export function premiereMessage(video: VideoView, template: string, pingRoleId: string | null, color: number, watchButton = false) {
  const message = videoMessage(video, template, pingRoleId, color, watchButton);
  if (video.scheduledStart && !Number.isNaN(video.scheduledStart.getTime())) {
    const unix = Math.floor(video.scheduledStart.getTime() / 1000);
    message.embeds[0]!.setDescription(`Premieres <t:${unix}:F> (<t:${unix}:R>)`).setTimestamp(video.scheduledStart);
  }
  return message;
}
