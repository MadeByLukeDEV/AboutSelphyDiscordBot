import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { MAX_VIP_LINKS, TWITCH_LOGIN_PATTERN } from "@aboutselphy/shared/twitchvip";
import type { Command } from "../../commands/types";
import { escapeText } from "../../lib/escape";
import { log } from "../../lib/log";
import { NoTwitchToken, resolveChannel, TwitchError } from "../twitch";
import { getVipConfig } from "./config";
import { countLinks, createLink, findByDiscord, findByTwitch } from "./repository";
import { unlinkVip } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

// /vip link claims a Twitch account for the member; staff approve it on the dashboard before the role is ever
// given, because anyone could type somebody else's name. Open to every member (no `requires`): the only thing
// a member can do is claim an account for themselves, remove their own claim, or look at its state.
const vip: Command = {
  data: new SlashCommandBuilder()
    .setName("vip")
    .setDescription("Link your Twitch account to get the VIP role")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) =>
      s
        .setName("link")
        .setDescription("Say which Twitch account is yours (staff confirm it)")
        .addStringOption((o) => o.setName("twitch").setDescription("Your Twitch name").setRequired(true).setMaxLength(25)),
    )
    .addSubcommand((s) => s.setName("unlink").setDescription("Remove your link (and the VIP role)"))
    .addSubcommand((s) => s.setName("status").setDescription("See the state of your link"))
    .toJSON(),
  async execute(i) {
    if (!i.inCachedGuild()) return;
    const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
    const config = await getVipConfig();
    if (!config.enabled || !config.roleId) return void (await reply("The Twitch VIP role isn't switched on."));
    const sub = i.options.getSubcommand();
    const mine = await findByDiscord(i.user.id);

    if (sub === "status") {
      if (!mine) return void (await reply("You haven't linked a Twitch account. Use `/vip link`."));
      return void (await reply(mine.approved ? `Linked to **${escapeText(mine.twitchLogin)}** and confirmed by staff. You get the VIP role while you are a VIP on the channel.` : `Linked to **${escapeText(mine.twitchLogin)}**, waiting for staff to confirm it.`));
    }

    if (sub === "unlink") {
      if (!mine) return void (await reply("You haven't linked a Twitch account."));
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const status = await unlinkVip(i.guild, mine.id);
      return void (await i.editReply({ content: status === "done" ? "Your link is removed." : "I couldn't remove it right now. Try again in a moment." }));
    }

    // link
    const login = i.options.getString("twitch", true).trim().replace(/^@/, "");
    if (!TWITCH_LOGIN_PATTERN.test(login)) return void (await reply("That doesn't look like a Twitch name (3 to 25 letters, digits or underscores)."));
    if (mine?.approved) return void (await reply(`You are already linked to **${escapeText(mine.twitchLogin)}**. Use \`/vip unlink\` first to change it.`));
    if (!mine && (await countLinks()) >= MAX_VIP_LINKS) return void (await reply("There are too many pending links right now. Ask a moderator."));
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const found = await resolveChannel(login);
      if (!found) return void (await i.editReply({ content: "I couldn't find that Twitch account." }));
      const taken = await findByTwitch(found.id);
      if (taken && taken.discordUserId !== i.user.id) return void (await i.editReply({ content: "That Twitch account is already linked to someone else. If it is yours, ask a moderator." }));
      if (mine) await unlinkVip(i.guild, mine.id); // replacing a pending claim
      await createLink({ discordUserId: i.user.id, discordName: i.member.displayName.slice(0, 100), twitchUserId: found.id, twitchLogin: found.login });
      log.info({ user: i.user.id, twitch: found.login }, "twitchvip: link requested");
      await i.editReply({ content: `Thanks! I noted **${escapeText(found.displayName)}** as your Twitch account. A moderator confirms it before you get the VIP role.` });
    } catch (err) {
      if (err instanceof NoTwitchToken || err instanceof TwitchError) log.warn({ err: err instanceof TwitchError ? { code: err.code } : err }, "twitchvip: could not look the account up");
      else log.error({ err }, "twitchvip: link failed");
      await i.editReply({ content: "I couldn't check that account right now. Try again in a moment." });
    }
  },
};

export const twitchVipCommands: Command[] = [vip];
