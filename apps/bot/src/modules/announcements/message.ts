import { EmbedBuilder } from "discord.js";
import { isAllowedImageUrl } from "@aboutselphy/shared/announcement";
import { truncate } from "../../lib/escape";

// An announcement row as Discord gets it. Staff write the text themselves, so
// markdown and links are kept, but nothing in it can ping anyone: allowedMentions
// allows only the one configured role, whatever is typed.

export type AnnouncementView = {
  content: string;
  embedEnabled: boolean;
  embedTitle: string;
  embedDescription: string;
  embedColor: number;
  embedImageUrl: string;
  pingRoleId: string | null;
};

export function buildAnnouncement(a: AnnouncementView) {
  const ping = a.pingRoleId ? `<@&${a.pingRoleId}>` : "";
  const text = [ping, a.content.trim()].filter(Boolean).join(" ");

  const embeds: EmbedBuilder[] = [];
  if (a.embedEnabled && (a.embedTitle.trim() || a.embedDescription.trim())) {
    const embed = new EmbedBuilder().setColor(a.embedColor);
    if (a.embedTitle.trim()) embed.setTitle(truncate(a.embedTitle.trim(), 256));
    if (a.embedDescription.trim()) embed.setDescription(truncate(a.embedDescription.trim(), 4000));
    // Re-checked here: the row is trusted, but a bad address must never reach Discord.
    if (a.embedImageUrl && isAllowedImageUrl(a.embedImageUrl)) embed.setImage(a.embedImageUrl);
    embeds.push(embed);
  }

  return {
    content: truncate(text, 2000),
    embeds,
    allowedMentions: a.pingRoleId ? { parse: [] as never[], roles: [a.pingRoleId] } : { parse: [] as never[] },
  };
}
