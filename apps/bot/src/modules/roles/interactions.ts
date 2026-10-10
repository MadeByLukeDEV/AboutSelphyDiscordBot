import { MessageFlags } from "discord.js";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { PANEL_PREFIX, parsePanelCustomId, planToggle } from "./panel";
import { findPanel } from "./repository";
import { checkRole } from "./service";

const NO_MENTIONS = { parse: [] as never[] };

/**
 * A click on a role panel. Nothing is trusted from the interaction: the custom ID is parsed
 * strictly, the panel is read from our table (a copied or old message does nothing), the
 * roles must belong to that panel, and each role is checked again right now (a role that
 * gained a powerful permission after the panel was posted is refused).
 */
async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID || (!i.isButton() && !i.isStringSelectMenu())) return;
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const say = (content: string) => i.editReply({ content, allowedMentions: NO_MENTIONS });

  const parsed = parsePanelCustomId(i.customId);
  if (!parsed) return void (await say("That control isn't valid any more."));
  const panel = await findPanel(parsed.panelId);
  if (!panel || !panel.messageId || panel.messageId !== i.message.id) return void (await say("This panel isn't active any more."));

  const chosen = i.isButton() ? (parsed.roleId ? [parsed.roleId] : []) : i.values;
  const panelRoleIds = panel.roles.map((r) => r.roleId);
  const plan = planToggle({ held: new Set(i.member.roles.cache.keys()), chosen, panelRoleIds, exclusive: panel.exclusive });
  if (plan.add.length === 0 && plan.remove.length === 0) return void (await say("Nothing to change."));

  const refused = plan.add.filter((id) => checkRole(i.guild, id) !== "ok");
  const add = plan.add.filter((id) => !refused.includes(id));
  const remove = plan.remove.filter((id) => i.guild.roles.cache.has(id));
  try {
    if (add.length) await i.member.roles.add(add, "Role panel");
    if (remove.length) await i.member.roles.remove(remove, "Role panel");
  } catch (err) {
    log.error({ err, panel: panel.id, user: i.user.id }, "role panel: changing roles failed");
    return void (await say("I couldn't change your roles. An admin needs to check that my role is above them."));
  }
  log.info({ panel: panel.id, user: i.user.id, add, remove, refused }, "role panel used");

  const lines = [
    ...add.map((id) => `Added <@&${id}>`),
    ...remove.map((id) => `Removed <@&${id}>`),
    ...(refused.length ? ["Some roles can't be given out right now. Tell a moderator."] : []),
  ];
  await say(lines.join("\n"));
}

export function registerRolePanels(): void {
  onComponent(PANEL_PREFIX, handle);
}
