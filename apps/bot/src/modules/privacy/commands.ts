import { ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ComponentType, InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "../../commands/types";
import { log } from "../../lib/log";
import { unlinkMember } from "../twitchvip";
import { deleteMember, exportMember } from "./repository";

const NO_MENTIONS = { parse: [] as never[] };

// /mydata: a member's own data rights, open to everyone and only ever about themselves (the user is always the one who
// typed the command, never an option). `export` sends a JSON file only they see; `delete` removes what they can remove
// themselves after a confirmation only they can press.
const mydata: Command = {
  data: new SlashCommandBuilder()
    .setName("mydata")
    .setDescription("See or delete the data this bot stores about you")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("export").setDescription("Get a file with everything stored about you (only you see it)"))
    .addSubcommand((s) => s.setName("delete").setDescription("Delete your birthday, reminders, levels, votes and links"))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const sub = i.options.getSubcommand();

    if (sub === "export") {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const data = await exportMember(i.user.id);
        const file = new AttachmentBuilder(Buffer.from(JSON.stringify(data, null, 2), "utf8"), { name: "my-data.json" });
        log.info({ user: i.user.id }, "mydata: exported");
        await i.editReply({ content: "Here is everything I store about you. Only you can see this message.", files: [file] });
      } catch (err) {
        log.error({ err }, "mydata: export failed");
        await i.editReply({ content: "I couldn't prepare your file right now. Try again in a moment." });
      }
      return;
    }

    // delete: a confirmation only the member can press, valid for one minute
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("md:confirm").setLabel("Yes, delete my data").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId("md:cancel").setLabel("Cancel").setStyle(ButtonStyle.Secondary),
    );
    const prompt = await i.reply({
      content:
        "This deletes your **birthday, pending reminders, level record, remembered roles, remembered voice room, invite record, votes, giveaway entries and Twitch link** (and the VIP role that came with it). Your name is removed from suggestions you wrote and from starboard posts.\n" +
        "Moderation cases and tickets are **kept**: they protect other members and answer appeals. Ask a moderator if you want those looked at.\nThis can't be undone.",
      components: [row],
      flags: MessageFlags.Ephemeral,
      allowedMentions: NO_MENTIONS,
      withResponse: true,
    });
    const message = prompt.resource?.message;
    if (!message) return;
    try {
      const pressed = await message.awaitMessageComponent({ componentType: ComponentType.Button, filter: (b) => b.user.id === i.user.id, time: 60_000 });
      if (pressed.customId !== "md:confirm") return void (await pressed.update({ content: "Cancelled. Nothing was deleted.", components: [] }));
      await pressed.deferUpdate();
      // The Twitch link first: the role has to come off before the row that says who has it is gone.
      const unlinked = await unlinkMember(i.guild, i.user.id);
      const counts = await deleteMember(i.user.id);
      log.info({ user: i.user.id, ...counts, twitchLinkRemoved: unlinked }, "mydata: deleted");
      await pressed.editReply({
        content: `Done. Removed: ${counts.birthday} birthday, ${counts.reminders} reminders, ${counts.levels} level record, ${counts.rememberedRoles} remembered roles, ${counts.votes} votes, ${counts.entries} giveaway entries${unlinked ? ", your Twitch link" : ""}. Your name is gone from ${counts.suggestionsAnonymised} suggestions and ${counts.starboardAnonymised} starboard posts.`,
        components: [],
      });
    } catch (err) {
      // No answer within a minute (awaitMessageComponent rejects) or a real failure: nothing is half done, the delete is one transaction.
      const timedOut = err instanceof Error && err.message.includes("time");
      if (!timedOut) log.error({ err }, "mydata: delete failed");
      await i.editReply({ content: timedOut ? "Timed out. Nothing was deleted." : "Something went wrong. Check what is left with `/mydata export` and try again.", components: [] }).catch(() => undefined);
    }
  },
};

export const privacyCommands: Command[] = [mydata];
