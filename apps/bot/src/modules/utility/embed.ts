import { ChannelType, EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { isAllowedImageUrl } from "@aboutselphy/shared/announcement";
import type { Command } from "../../commands/types";
import { withEmotes } from "../../lib/emotes";
import { truncate } from "../../lib/escape";
import { log } from "../../lib/log";

// /embed: a moderator posts a tidy embed in a channel. Their markdown is kept (they are staff), the server's emotes work,
// and nothing can ping. "\n" in the description becomes a line break because a slash option is one line.

/** "#00ffa8" or "00ffa8" -> 0x00ffa8, or null when it isn't a 6-digit hex colour. */
export function parseHexColor(text: string): number | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(text.trim());
  return m ? parseInt(m[1]!, 16) : null;
}

export type EmbedInput = { title: string; description: string; color: string; image: string; footer: string };

/** Validates and builds the embed. A string is the problem to tell the moderator. */
export function buildStaffEmbed(input: EmbedInput): EmbedBuilder | string {
  const title = input.title.trim();
  const description = input.description.replace(/\\n/g, "\n").trim();
  if (title === "" && description === "") return "Give the embed a title or a description.";
  let color = 0x00ffa8;
  if (input.color.trim() !== "") {
    const parsed = parseHexColor(input.color);
    if (parsed === null) return "The colour must be a hex code like #00ffa8.";
    color = parsed;
  }
  if (input.image.trim() !== "" && !(isAllowedImageUrl(input.image.trim()) && input.image.trim().startsWith("https://"))) return "The picture must be an https address.";
  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(truncate(withEmotes(title), 256));
  if (description) embed.setDescription(truncate(withEmotes(description), 4000));
  if (input.image.trim()) embed.setImage(input.image.trim());
  if (input.footer.trim()) embed.setFooter({ text: truncate(input.footer.trim(), 200) });
  return embed;
}

export const embedCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("embed")
    .setDescription("Post an embed in a channel (moderators)")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((o) => o.setName("title").setDescription("Title").setMaxLength(256))
    .addStringOption((o) => o.setName("description").setDescription("Text; write \\n for a new line").setMaxLength(4000))
    .addChannelOption((o) => o.setName("channel").setDescription("Where to post (default: here)").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
    .addStringOption((o) => o.setName("color").setDescription("Hex colour, for example #00ffa8").setMaxLength(7))
    .addStringOption((o) => o.setName("image").setDescription("Big picture (https address)").setMaxLength(500))
    .addStringOption((o) => o.setName("footer").setDescription("Small text at the bottom").setMaxLength(200))
    .toJSON(),
  requires: "moderator",
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const built = buildStaffEmbed({
      title: i.options.getString("title") ?? "",
      description: i.options.getString("description") ?? "",
      color: i.options.getString("color") ?? "",
      image: i.options.getString("image") ?? "",
      footer: i.options.getString("footer") ?? "",
    });
    if (typeof built === "string") return void (await i.reply({ content: built, flags: MessageFlags.Ephemeral }));
    const target = i.options.getChannel("channel") ?? i.channel;
    const channel = target && "id" in target ? await i.guild.channels.fetch(target.id).catch(() => null) : null;
    if (!channel || !channel.isTextBased() || !("send" in channel)) return void (await i.reply({ content: "I can't post in that channel.", flags: MessageFlags.Ephemeral }));
    try {
      await channel.send({ embeds: [built], allowedMentions: { parse: [] } });
    } catch (err) {
      log.warn({ err, channelId: channel.id }, "embed: could not post");
      return void (await i.reply({ content: "I couldn't post there. Check that I can send messages and embeds in that channel.", flags: MessageFlags.Ephemeral }));
    }
    log.info({ channelId: channel.id, by: i.user.id }, "embed: posted");
    await i.reply({ content: `Posted in <#${channel.id}>.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  },
};
