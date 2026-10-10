import { MessageFlags } from "discord.js";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { find, selection, setSelection } from "./repository";
import { nextSelection, parseVoteControl, POLL_PREFIX } from "./rules";
import { refreshSoon } from "./service";

/**
 * A vote button. Nothing is trusted from the interaction: the id is parsed strictly, the poll is read
 * from our table, it must be running, before its end and the very message that was clicked, and the
 * option must exist. The member's choices are replaced in one transaction.
 */
async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID || !i.isButton() || i.user.bot) return;
  const say = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  const control = parseVoteControl(i.customId);
  if (!control) return void (await say("That button isn't valid any more."));
  const poll = await find(control.id);
  if (!poll || poll.status !== "active" || poll.messageId !== i.message.id) return void (await say("This poll isn't running any more."));
  if (poll.endsAt && poll.endsAt.getTime() <= Date.now()) return void (await say("This poll has just ended."));
  if (control.index >= poll.options.length) return void (await say("That option doesn't exist."));

  const next = nextSelection(await selection(poll.id, i.user.id), control.index, poll.multiple);
  await setSelection(poll.id, i.user.id, next);
  log.info({ poll: poll.id, user: i.user.id }, "poll vote");
  refreshSoon(i.guild, poll.id);
  const names = [...next].sort((a, b) => a - b).map((n) => `**${n + 1}.** ${poll.options[n]}`);
  await say(next.size === 0 ? "Your vote was withdrawn." : `Your vote: ${names.join(", ").replace(/[<>@`]/g, "")}`);
}

export function registerPollControls(): void {
  onComponent(POLL_PREFIX, handle);
}
