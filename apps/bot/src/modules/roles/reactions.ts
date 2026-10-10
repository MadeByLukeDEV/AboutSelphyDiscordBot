import { Events, type Client, type MessageReaction, type PartialMessageReaction, type PartialUser, type User } from "discord.js";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { emojiMatches, planToggle } from "./panel";
import { findPanelByMessage } from "./repository";
import { checkRole } from "./service";

/**
 * Reaction roles: reacting to a "reactions" panel gives the role, removing the reaction takes it
 * back. Nothing is trusted from the event: the message must be a panel's current message, the
 * emoji must be one of that panel's, and the role is checked again right now (same rule as the
 * buttons). A reaction the bot doesn't want is removed again so the message stays tidy.
 */
async function onReaction(reactionIn: MessageReaction | PartialMessageReaction, userIn: User | PartialUser, added: boolean): Promise<void> {
  if (userIn.bot || !(await moduleOn("roles"))) return;
  const reaction = reactionIn.partial ? await reactionIn.fetch().catch(() => null) : reactionIn;
  if (!reaction) return;
  const guild = reaction.message.guild;
  if (!guild || guild.id !== env().DISCORD_GUILD_ID) return;

  const panel = await findPanelByMessage(reaction.message.id);
  if (!panel || panel.style !== "reactions") return;

  const hit = panel.roles.find((r) => emojiMatches(r.emoji, { id: reaction.emoji.id, name: reaction.emoji.name }));
  if (!hit) {
    if (added) await reaction.users.remove(userIn.id).catch(() => undefined); // not one of the panel's emoji
    return;
  }

  const member = await guild.members.fetch(userIn.id).catch(() => null);
  if (!member) return;
  const panelRoleIds = panel.roles.map((r) => r.roleId);

  try {
    if (added) {
      if (member.roles.cache.has(hit.roleId)) return;
      if (checkRole(guild, hit.roleId) !== "ok") {
        log.warn({ panel: panel.id, role: hit.roleId }, "reaction role refused: the role can't be handed out");
        await reaction.users.remove(userIn.id).catch(() => undefined);
        return;
      }
      const plan = planToggle({ held: new Set(member.roles.cache.keys()), chosen: [hit.roleId], panelRoleIds, exclusive: panel.exclusive });
      if (plan.add.length) await member.roles.add(plan.add, "Role panel (reaction)");
      if (plan.remove.length) await member.roles.remove(plan.remove, "Role panel (reaction)");
      // "Choose one": take the member's other reactions off so the message shows their single choice.
      if (panel.exclusive) {
        for (const other of reaction.message.reactions.cache.values()) {
          if (other.emoji.id === reaction.emoji.id && other.emoji.name === reaction.emoji.name) continue;
          await other.users.remove(userIn.id).catch(() => undefined);
        }
      }
      log.info({ panel: panel.id, user: userIn.id, add: plan.add, remove: plan.remove }, "reaction role added");
    } else if (member.roles.cache.has(hit.roleId)) {
      await member.roles.remove(hit.roleId, "Role panel (reaction removed)");
      log.info({ panel: panel.id, user: userIn.id, remove: hit.roleId }, "reaction role removed");
    }
  } catch (err) {
    log.error({ err, panel: panel.id, user: userIn.id }, "reaction role failed");
  }
}

/** Needs the GuildMessageReactions intent (not privileged) and partials for messages not in the cache. */
export function registerReactionRoles(client: Client): void {
  client.on(Events.MessageReactionAdd, (reaction, user) => void onReaction(reaction, user, true).catch((err) => log.error({ err }, "reaction handler failed")));
  client.on(Events.MessageReactionRemove, (reaction, user) => void onReaction(reaction, user, false).catch((err) => log.error({ err }, "reaction handler failed")));
}
