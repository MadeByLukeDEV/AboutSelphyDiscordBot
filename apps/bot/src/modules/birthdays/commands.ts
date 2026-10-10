import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { isValidDay } from "@aboutselphy/shared/birthdays";
import type { Command } from "../../commands/types";
import { getBirthdayConfig } from "./config";
import { allBirthdays, findBirthday, removeBirthday, saveBirthday } from "./repository";
import { daysUntil, formatDay, todayIn } from "./rules";

const NO_MENTIONS = { parse: [] as never[] };

const birthday: Command = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("Birthdays")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("set")
        .setDescription("Save your birthday (day and month only)")
        .addIntegerOption((o) => o.setName("month").setDescription("Month, 1-12").setRequired(true).setMinValue(1).setMaxValue(12))
        .addIntegerOption((o) => o.setName("day").setDescription("Day, 1-31").setRequired(true).setMinValue(1).setMaxValue(31)),
    )
    .addSubcommand((s) => s.setName("remove").setDescription("Forget your birthday"))
    .addSubcommand((s) => s.setName("show").setDescription("Show a member's birthday").addUserOption((o) => o.setName("member").setDescription("Whose birthday (default: yours)")))
    .addSubcommand((s) => s.setName("upcoming").setDescription("The next birthdays in the server"))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string, ephemeral = true) => i.reply({ content, flags: ephemeral ? MessageFlags.Ephemeral : undefined, allowedMentions: NO_MENTIONS });
    const sub = i.options.getSubcommand();

    if (sub === "set") {
      const month = i.options.getInteger("month", true);
      const day = i.options.getInteger("day", true);
      if (!isValidDay(month, day)) return void (await reply("That date doesn't exist."));
      await saveBirthday(i.user.id, i.member.displayName, month, day);
      return void (await reply(`Saved: your birthday is on ${formatDay(month, day)}. Only the day and month are stored. \`/birthday remove\` deletes it.`));
    }
    if (sub === "remove") {
      const { count } = await removeBirthday(i.user.id);
      return void (await reply(count > 0 ? "Your birthday was deleted." : "You hadn't saved a birthday."));
    }
    if (sub === "show") {
      const user = i.options.getUser("member") ?? i.user;
      const found = await findBirthday(user.id);
      return void (await reply(found ? `<@${user.id}>'s birthday is on ${formatDay(found.month, found.day)}.` : user.id === i.user.id ? "You haven't saved a birthday yet: `/birthday set`." : "They haven't saved a birthday.", false));
    }
    // upcoming
    const config = await getBirthdayConfig();
    const today = todayIn(new Date(), config.timeZone);
    const next = (await allBirthdays())
      .filter((b) => i.guild.members.cache.has(b.userId))
      .map((b) => ({ b, in: daysUntil(b, today) }))
      .sort((a, c) => a.in - c.in)
      .slice(0, 10);
    if (next.length === 0) return void (await reply("Nobody has saved a birthday yet: `/birthday set`.", false));
    const lines = next.map(({ b, in: n }) => `<@${b.userId}> · ${formatDay(b.month, b.day)}${n === 0 ? " · **today** 🎂" : n === 1 ? " · tomorrow" : ` · in ${n} days`}`);
    await reply(`**Upcoming birthdays**\n${lines.join("\n")}`, false);
  },
};

export const birthdayCommands: Command[] = [birthday];
