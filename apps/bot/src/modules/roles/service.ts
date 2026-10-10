import { PermissionFlagsBits, type Guild } from "discord.js";
import type { RoleCreateResponse, RolePanelDeleteStatus, RolePanelPublishStatus } from "@aboutselphy/shared";
import { env } from "../../lib/env";
import { log } from "../../lib/log";
import { buildPanelMessage, type PanelView } from "./panel";
import { findPanel, setPanelMessage } from "./repository";
import { whyUnassignable } from "./safety";

/** Can the bot hand this role out? Reads the live role, so a role edited later is judged as it is now. */
export function checkRole(guild: Guild, roleId: string): "ok" | "missing" | "unassignable" {
  const role = guild.roles.cache.get(roleId);
  if (!role) return "missing";
  const me = guild.members.me;
  if (!me) return "unassignable";
  const why = whyUnassignable(
    { id: role.id, guildId: guild.id, managed: role.managed, position: role.position, permissions: role.permissions.bitfield },
    me.roles.highest.position,
  );
  return why === null ? "ok" : "unassignable";
}

type PanelRow = NonNullable<Awaited<ReturnType<typeof findPanel>>>;

export const toView = (p: PanelRow): PanelView => ({
  id: p.id,
  title: p.title,
  description: p.description,
  color: p.color,
  style: p.style,
  exclusive: p.exclusive,
  roles: p.roles.map((r) => ({ roleId: r.roleId, label: r.label, emoji: r.emoji, description: r.description })),
});

/** Posts the panel, or edits the message it already has. */
export async function publishPanel(guild: Guild, id: string): Promise<RolePanelPublishStatus> {
  try {
    const panel = await findPanel(id);
    if (!panel) return "not-found";
    await guild.roles.fetch(); // make sure the cache is current before judging roles
    if (panel.roles.length === 0 || panel.roles.some((r) => checkRole(guild, r.roleId) !== "ok")) return "roles";

    const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
    if (!channel || channel.isDMBased() || channel.guildId !== env().DISCORD_GUILD_ID || !channel.isTextBased() || !("send" in channel)) return "channel";

    const payload = buildPanelMessage(toView(panel));
    if (panel.messageId) {
      const existing = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (existing) {
        await existing.edit(payload);
        log.info({ panel: id }, "role panel updated");
        return "updated";
      }
    }
    const message = await channel.send(payload);
    await setPanelMessage(id, message.id);
    log.info({ panel: id, channelId: channel.id, messageId: message.id }, "role panel published");
    return "published";
  } catch (err) {
    log.error({ err, panel: id }, "publishing a role panel failed");
    return "failed";
  }
}

/** Deletes the panel's Discord message. The dashboard removes the rows. */
export async function deletePanelMessage(guild: Guild, id: string): Promise<RolePanelDeleteStatus> {
  try {
    const panel = await findPanel(id);
    if (!panel) return "not-found";
    if (!panel.messageId) return "already-gone";
    const channel = await guild.channels.fetch(panel.channelId).catch(() => null);
    const message = channel && !channel.isDMBased() && channel.isTextBased() ? await channel.messages.fetch(panel.messageId).catch(() => null) : null;
    if (!message) return "already-gone";
    await message.delete();
    log.info({ panel: id }, "role panel message deleted");
    return "deleted";
  } catch (err) {
    log.error({ err, panel: id }, "deleting a role panel message failed");
    return "failed";
  }
}

/**
 * Creates a cosmetic role: a name, a colour, and the two display switches. It never gets any
 * permission, so a role made here can't grant anything. New roles sit at the bottom, below the bot.
 */
export async function createRole(
  guild: Guild,
  input: { name: string; color: number; hoist: boolean; mentionable: boolean },
  by: string,
): Promise<RoleCreateResponse> {
  try {
    const me = guild.members.me ?? (await guild.members.fetchMe());
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return { status: "forbidden" };
    if (guild.roles.cache.size >= 250) return { status: "tooMany" };
    const role = await guild.roles.create({
      name: input.name,
      color: input.color,
      hoist: input.hoist,
      mentionable: input.mentionable,
      permissions: [],
      reason: `Created from the dashboard by ${by}`,
    });
    log.info({ role: role.id, by }, "role created from the dashboard");
    return { status: "created", role: { id: role.id, name: role.name, color: role.color, assignable: true } };
  } catch (err) {
    log.error({ err }, "creating a role failed");
    return { status: "failed" };
  }
}
