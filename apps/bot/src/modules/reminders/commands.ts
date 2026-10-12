import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { parseDuration } from "@aboutselphy/shared/duration";
import { MAX_REMINDER_MESSAGE, MAX_REPEAT_TIMES } from "@aboutselphy/shared/reminders";
import type { Command } from "../../commands/types";
import { getReminderConfig } from "./config";
import { cancelReminder, createReminder, listPending, pendingCount } from "./repository";
import { isAllowedDelay, isAllowedRepeat, reminderLine } from "./rules";

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
        .addStringOption((o) => o.setName("repeat").setDescription("Repeat every, e.g. 1d or 1w (at least 1h)").setMaxLength(12))
        .addIntegerOption((o) => o.setName("times").setDescription("How many times in total when repeating (default 4)").setMinValue(2).setMaxValue(MAX_REPEAT_TIMES))
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
      const repeatText = i.options.getString("repeat");
      const every = repeatText ? parseDuration(repeatText) : null;
      if (repeatText && !isAllowedRepeat(every)) return void (await reply("A repeat needs a length between 1 hour and 1 year, e.g. `1d` or `1w`."));
      const repeatsLeft = every ? (i.options.getInteger("times") ?? 4) - 1 : 0;
      await createReminder({ userId: i.user.id, channelId: i.channelId, message: about, remindAt, delivery, ...(every ? { repeatEverySeconds: every, repeatsLeft } : {}) });
      return void (await reply(`Okay, I'll remind you <t:${Math.floor(remindAt.getTime() / 1000)}:R> (<t:${Math.floor(remindAt.getTime() / 1000)}:f>). ${delivery === "channel" ? "I'll post it in this channel." : "I'll send it by DM; if your DMs are closed I'll post it in this channel."}${every ? ` It repeats ${repeatsLeft} more ${repeatsLeft === 1 ? "time" : "times"}, every ${repeatText}.` : ""}`));
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
