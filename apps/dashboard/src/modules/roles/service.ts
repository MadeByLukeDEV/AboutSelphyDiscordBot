import "server-only";
import { parseEmoji, type RolePanelInput } from "@aboutselphy/shared/role-panel";
import { errorInfo } from "@/lib/log";
import { createGuildRole, deleteRolePanelMessage, listChannels, listEmojis, listRoles, publishRolePanel } from "@/modules/bot-api";
import type { StaffSession } from "@/modules/auth";
import { createPanel, deletePanel, findPanel, listPanels, updatePanel, type PanelWithRoles } from "./repository";
import type { CreateRoleInput, CreateRoleResult, DeletePanelResult, RolesError, RolePanelView, SavePanelResult } from "./schema";

const toView = (p: PanelWithRoles): RolePanelView => ({
  id: p.id,
  channelId: p.channelId,
  messageId: p.messageId,
  title: p.title,
  description: p.description,
  color: p.color,
  style: p.style,
  exclusive: p.exclusive,
  roles: p.roles.map((r) => ({ roleId: r.roleId, label: r.label, emoji: r.emoji, description: r.description })),
  createdByName: p.createdByName,
});

/** The panels plus the channels and roles to pick from (null = the bot can't be reached). */
export async function getRolesPage() {
  const [panels, channels, roles, emojis] = await Promise.all([listPanels(), listChannels(["text"]), listRoles(), listEmojis()]);
  return { panels: panels.map(toView), channels, roles, emojis };
}

const fail = (error: RolesError) => ({ ok: false as const, error });

/** A cosmetic role, made by the bot. It never gets any permission. */
export async function createRoleFromDashboard(input: CreateRoleInput, by: StaffSession["user"]): Promise<CreateRoleResult> {
  try {
    const result = await createGuildRole(input, by.name);
    if (!result) return fail("botUnavailable");
    if (result.status === "created") return { ok: true, role: { id: result.role.id, name: result.role.name, color: result.role.color } };
    if (result.status === "forbidden") return fail("needsPermission");
    if (result.status === "tooMany") return fail("tooManyRoles");
    return fail("failed");
  } catch (error) {
    console.error("[roles] creating a role failed", errorInfo(error));
    return fail("failed");
  }
}

/**
 * Saves a panel and, if asked, posts it. Every role must be one the bot may hand out (the
 * bot's own list says so; when it can't answer, the save is refused rather than trusted),
 * and the channel must be a text channel of the server. The bot checks all of it again when it
 * posts and when a member clicks.
 */
export async function savePanel(input: RolePanelInput, by: StaffSession["user"]): Promise<SavePanelResult> {
  try {
    const existing = input.id ? await findPanel(input.id) : null;
    if (input.id && !existing) return fail("notFound");

    const [channels, roles] = await Promise.all([listChannels(["text"]), listRoles()]);
    if (!channels || !roles) return fail("botUnavailable");
    if (!channels.some((c) => c.id === input.channelId)) return fail("channelNotFound");
    for (const r of input.roles) {
      const known = roles.find((x) => x.id === r.roleId);
      if (!known) return fail("roleNotFound");
      if (!known.assignable) return fail("roleNotAllowed");
    }
    // A server emote must be one of this server's (checked through the bot; refused if it can't answer).
    const customIds = input.roles.flatMap((r) => {
      const parsed = parseEmoji(r.emoji);
      return parsed?.kind === "custom" ? [parsed.id] : [];
    });
    if (customIds.length > 0) {
      const emojis = await listEmojis();
      if (!emojis) return fail("botUnavailable");
      if (customIds.some((id) => !emojis.some((e) => e.id === id))) return fail("emojiNotFound");
    }
    // A posted panel stays in its channel (the message can't move); move it by deleting and creating.
    if (existing?.messageId && existing.channelId !== input.channelId) return fail("invalid");

    const data = { channelId: input.channelId, title: input.title, description: input.description, color: input.color, style: input.style, exclusive: input.exclusive };
    const roleViews = input.roles.map((r) => ({ roleId: r.roleId, label: r.label, emoji: r.emoji, description: r.description }));
    const saved = existing ? await updatePanel(existing.id, data, roleViews) : await createPanel(data, roleViews, by.name);

    let posted: "published" | "updated" | null = null;
    let postError: RolesError | null = null;
    // A panel that is already posted is always refreshed, so the message never disagrees with the list.
    if (input.publish || saved.messageId) {
      const status = await publishRolePanel(saved.id);
      if (status === "published" || status === "updated") posted = status;
      else postError = status === null ? "botUnavailable" : status === "channel" ? "channelNotFound" : status === "roles" ? "roleNotAllowed" : status === "emoji" ? "emojiNotFound" : "failed";
    }
    const fresh = (await findPanel(saved.id)) ?? saved;
    return { ok: true, panel: toView(fresh), posted, postError };
  } catch (error) {
    console.error("[roles] saving a panel failed", errorInfo(error));
    return fail("failed");
  }
}

/** Deletes a panel. A posted one is removed from Discord first; if Discord can't be reached the panel stays. */
export async function removePanel(id: string): Promise<DeletePanelResult> {
  try {
    const existing = await findPanel(id);
    if (!existing) return fail("notFound");
    if (existing.messageId) {
      const status = await deleteRolePanelMessage(id);
      if (status === null || status === "failed") return fail("botUnavailable");
    }
    await deletePanel(id);
    return { ok: true };
  } catch (error) {
    console.error("[roles] deleting a panel failed", errorInfo(error));
    return fail("failed");
  }
}
