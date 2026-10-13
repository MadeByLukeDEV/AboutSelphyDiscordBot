import { EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../commands/types";
import { getStarboardConfig } from "./config";
import { authorStats, countOnBoard, randomOnBoard, topAuthors } from "./repository";
import { randomPostText } from "./rules";

const NO_MENTIONS = { parse: [] as never[] };

const starboard: Command = {
  data: new SlashCommandBuilder()
    .setName("starboard")
    .setDescription("The starboard")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("random").setDescription("A random message from the starboard"))
    .addSubcommand((s) => s.setName("stats").setDescription("How many starboard posts and stars a member has").addUserOption((o) => o.setName("member").setDescription("Whose stats (default: yours)")))
    .addSubcommand((s) => s.setName("top").setDescription("The members with the most starboard posts"))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const config = await getStarboardConfig();
    const reply = (content: string, ephemeral = true) => i.reply({ content, flags: ephemeral ? MessageFlags.Ephemeral : undefined, allowedMentions: NO_MENTIONS });
    if (!config.enabled) return void (await reply("The starboard isn't switched on in this server."));
    const sub = i.options.getSubcommand();

    if (sub === "random") {
      const post = await randomOnBoard(await countOnBoard());
      if (!post) return void (await reply("Nothing is on the starboard yet.", false));
      return void (await reply(randomPostText(post, config.emoji), false));
    }
    if (sub === "stats") {
      const user = i.options.getUser("member") ?? i.user;
      const stats = await authorStats(user.id);
      return void (await reply(stats.posts === 0 ? `<@${user.id}> has no starboard posts yet.` : `<@${user.id}> has **${stats.posts}** ${stats.posts === 1 ? "post" : "posts"} on the starboard with **${stats.stars}** ${config.emoji} in total.`, false));
    }
    const top = await topAuthors(10);
    if (top.length === 0) return void (await reply("Nothing is on the starboard yet.", false));
    const lines = top.map((t, n) => `**${n + 1}.** <@${t.authorId}> · ${t.posts} ${t.posts === 1 ? "post" : "posts"} · ${t.stars} ${config.emoji}`);
    await i.reply({ embeds: [new EmbedBuilder().setColor(0x00ffa8).setTitle("Starboard hall of fame").setDescription(lines.join("\n"))], allowedMentions: NO_MENTIONS });
  },
};

export const starboardCommands: Command[] = [starboard];
