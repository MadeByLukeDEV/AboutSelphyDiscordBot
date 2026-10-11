import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { parseDuration } from "@aboutselphy/shared/duration";
import { MAX_REMINDER_MESSAGE } from "@aboutselphy/shared/reminders";
import type { Command } from "../../commands/types";
import { getReminderConfig } from "./config";
import { cancelReminder, createReminder, listPending, pendingCount } from "./repository";
import { isAllowedDelay, reminderLine } from "./rules";

const NO_MENTIONS = { parse: [] as never[] };

const remind: Command = {
  data: new SlashCommandBuilder()
    .setName("remind")
    .setDescription("Reminders")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("me")
        .setDescription("Remind me of something later")
        .addStringOption((o) => o.setName("in").setDescription("How long from now, e.g. 30m, 2h or 3d").setRequired(true).setMaxLength(12))
        .addStringOption((o) => o.setName("about").setDescription("What to remind you of").setRequired(true).setMaxLength(MAX_REMINDER_MESSAGE))
        .addStringOption((o) =>
          o.setName("where").setDescription("Where to remind you (default: a DM)").addChoices({ name: "In a DM", value: "dm" }, { name: "In the channel", value: "channel" }),
        ),
    )
    .addSubcommand((s) => s.setName("list").setDescription("Your pending reminders"))
    .addSubcommand((s) => s.setName("cancel").setDescription("Cancel one of your reminders").addIntegerOption((o) => o.setName("number").setDescription("Its number in /remind list").setRequired(true).setMinValue(1).setMaxValue(50)))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const sub = i.options.getSubcommand();

    // One channel for all of /remind, when the admins picked one (the reply is private, so it doesn't clutter other channels).
    const config = await getReminderConfig();
    if (config.channelId && i.channelId !== config.channelId) return void (await reply(`Reminders only work in <#${config.channelId}>. Please use the command there.`));

    if (sub === "me") {
      if (!config.enabled) return void (await reply("Reminders are switched off."));
      const seconds = parseDuration(i.options.getString("in", true));
      if (!isAllowedDelay(seconds)) return void (await reply("Pick a time between 1 minute and 1 year, e.g. `30m`, `2h` or `3d`."));
      const about = i.options.getString("about", true).trim();
      if (!about) return void (await reply("Say what to remind you of."));
      if ((await pendingCount(i.user.id)) >= config.maxPerUser) return void (await reply(`You already have ${config.maxPerUser} pending reminders. Cancel one with \`/remind cancel\`.`));
      const remindAt = new Date(Date.now() + seconds * 1000);
      const delivery = i.options.getString("where") === "channel" ? "channel" : "dm";
      await createReminder({ userId: i.user.id, channelId: i.channelId, message: about, remindAt, delivery });
      return void (await reply(`Okay, I'll remind you <t:${Math.floor(remindAt.getTime() / 1000)}:R> (<t:${Math.floor(remindAt.getTime() / 1000)}:f>). ${delivery === "channel" ? "I'll post it in this channel." : "I'll send it by DM; if your DMs are closed I'll post it in this channel."}`));
    }

    const pending = await listPending(i.user.id);
    if (sub === "list") {
      return void (await reply(pending.length === 0 ? "You have no pending reminders." : `**Your reminders**\n${pending.slice(0, 25).map(reminderLine).join("\n")}`));
    }
    const target = pending[i.options.getInteger("number", true) - 1];
    if (!target) return void (await reply("There is no reminder with that number. See `/remind list`."));
    await reply((await cancelReminder(target.id, i.user.id)) ? "Reminder cancelled." : "That reminder was already delivered.");
  },
};

export const reminderCommands: Command[] = [remind];
