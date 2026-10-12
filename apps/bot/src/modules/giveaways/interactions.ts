import { MessageFlags } from "discord.js";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { levelFromXp } from "@aboutselphy/shared/levels";
import { entryProblem, GIVEAWAY_PREFIX, parseEnterControl, problemText } from "./rules";
import { countEntries, find, hasEntry, toggleEntry, xpOf } from "./repository";

/**
 * The Enter button. Nothing is trusted from the interaction: the id is parsed strictly, the giveaway is
 * read from our table, it must be running, not past its end, and pressed on its own message, and the
 * member must hold the required role (read now) and not be a bot. Pressing again takes the entry back.
 */
async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID || !i.isButton()) return;
  const say = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

  const id = parseEnterControl(i.customId);
  if (!id) return void (await say("That button isn't valid any more."));
  const g = await find(id);
  if (!g || g.status !== "active" || g.messageId !== i.message.id) return void (await say("This giveaway isn't running any more."));
  if (g.endsAt.getTime() <= Date.now()) return void (await say("This giveaway has just ended. The winners are announced in a moment."));
  if (i.user.bot) return;
  if (g.requiredRoleId && !i.member.roles.cache.has(g.requiredRoleId)) return void (await say(`You need the <@&${g.requiredRoleId}> role to enter this giveaway.`));

  // Withdrawing is always allowed; entering needs the requirements beyond the role.
  const req = { minAccountDays: g.minAccountDays, minMemberDays: g.minMemberDays, minLevel: g.minLevel };
  if (req.minAccountDays + req.minMemberDays + req.minLevel > 0) {
    const level = req.minLevel > 0 ? levelFromXp(await xpOf(i.user.id)) : 0;
    const problem = entryProblem(req, { accountCreatedAt: i.user.createdAt, joinedAt: i.member.joinedAt, level }, new Date());
    if (problem && !(await hasEntry(g.id, i.user.id))) return void (await say(problemText(problem)));
  }

  const entered = await toggleEntry(g.id, i.user.id);
  log.info({ giveaway: g.id, user: i.user.id, entered }, "giveaway entry");
  await say(entered ? `🎉 You're in! Good luck. (${await countEntries(g.id)} entries so far)\nPress the button again to withdraw.` : "You withdrew from the giveaway.");
}

export function registerGiveawayControls(): void {
  onComponent(GIVEAWAY_PREFIX, handle);
}
