import { EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";

// The announcement for a new video. Titles and channel names come from YouTube and
// are escaped; staff's template is kept as written. Only the one configured role can
// be pinged. The picture is only taken from YouTube's own image hosts.

export type VideoView = { videoId: string; title: string; channelTitle: string; publishedAt: Date; thumbnailUrl: string | null };

export const videoUrl = (videoId: string) => `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

export function safeThumbnail(url: string | null): string | undefined {
  return url && /^https:\/\/(?:i|i9)\.ytimg\.com\//i.test(url) ? url : undefined;
}

/** {title} {channel} {url} in the template; the title and channel are escaped. */
export function renderTemplate(template: string, video: VideoView): string {
  const values: Record<string, string> = { title: escapeText(video.title), channel: escapeText(video.channelTitle), url: videoUrl(video.videoId) };
  return template.replace(/\{(title|channel|url)\}/g, (_, key: string) => values[key] ?? "");
}

export function videoMessage(video: VideoView, template: string, pingRoleId: string | null, color: number) {
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
    allowedMentions: pingRoleId ? { parse: [] as never[], roles: [pingRoleId] } : { parse: [] as never[] },
  };
}
