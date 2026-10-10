import { MessageFlags } from "discord.js";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { currentVote, find, setVote } from "./repository";
import { nextVote, parseVoteControl, SUGGESTION_PREFIX } from "./rules";
import { refreshSoon } from "./service";

/**
 * The vote buttons. Nothing is trusted from the interaction: the id is parsed strictly, the suggestion is
 * read from our table, it must be open and the very message that was clicked, and the author can't vote
 * on their own idea. Pressing the same button again takes the vote back; the other one switches sides.
 */
async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID || !i.isButton()) return;
  const say = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  const control = parseVoteControl(i.customId);
  if (!control) return void (await say("That button isn't valid any more."));
  const s = await find(control.id);
  if (!s || s.messageId !== i.message.id) return void (await say("This suggestion isn't active any more."));
  if (s.status !== "open") return void (await say("Voting is closed: this suggestion was already decided."));
  if (i.user.id === s.authorId) return void (await say("You can't vote on your own suggestion."));

  const next = nextVote(await currentVote(s.id, i.user.id), control.value);
  await setVote(s.id, i.user.id, next);
  log.info({ suggestion: s.number, user: i.user.id, vote: next }, "suggestion vote");
  refreshSoon(i.guild, s.id);
  await say(next === null ? "Your vote was removed." : next === 1 ? "👍 You voted for this suggestion." : "👎 You voted against this suggestion.");
}

export function registerSuggestionControls(): void {
  onComponent(SUGGESTION_PREFIX, handle);
}
