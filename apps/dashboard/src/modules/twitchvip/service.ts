import "server-only";
import type { TwitchVipConfig, TwitchVipLink } from "@aboutselphy/db";
import { VIP_STATUSES, type VipSettings, type VipStatus } from "@aboutselphy/shared/twitchvip";
import { errorInfo } from "@/lib/log";
import { listRoles, reloadBotModule, unlinkTwitchVipViaBot } from "@/modules/bot-api";
import { approveLink as approve, findLink, listLinks, readConfig, updateConfig } from "./repository";
import type { SaveVipResult, VipLinkResult, VipLinkRow, VipState } from "./schema";

const toSettings = (c: TwitchVipConfig): VipSettings => ({ enabled: c.enabled, roleId: c.roleId ?? "" });
const toStatus = (value: string): VipStatus => (VIP_STATUSES as readonly string[]).includes(value) ? (value as VipStatus) : "unknown";
const toRow = (l: TwitchVipLink): VipLinkRow => ({ id: l.id, discordUserId: l.discordUserId, discordName: l.discordName, twitchLogin: l.twitchLogin, approved: l.approved, approvedByName: l.approvedByName, createdAt: l.createdAt.toISOString() });

/** Settings, the state of the last sync, every link (pending first) and the roles to pick from (null = bot unreachable). */
export async function getTwitchVipPage() {
  const [config, links, roles] = await Promise.all([readConfig(), listLinks(), listRoles()]);
  const state: VipState = { status: toStatus(config.status), vipCount: config.vipCount, lastSyncAt: config.lastSyncAt?.toISOString() ?? null };
  return { settings: toSettings(config), state, links: links.map(toRow), roles };
}

/** Saves the settings. A new role must be a real role the bot may hand out (checked through the bot; refused if it can't answer). */
export async function saveVipSettings(input: VipSettings): Promise<SaveVipResult> {
  try {
    const current = await readConfig();
    if (input.roleId && input.roleId !== current.roleId) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      const role = roles.find((r) => r.id === input.roleId);
      if (!role) return { ok: false, error: "roleNotFound" };
      if (!role.assignable) return { ok: false, error: "roleNotUsable" };
    }
    const saved = await updateConfig({ enabled: input.enabled, roleId: input.roleId || null });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("twitchvip") };
  } catch (error) {
    console.error("[twitchvip] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Confirms a member's claim; the bot then syncs and gives the role if the account is a VIP. */
export async function approveVipLink(id: string, byName: string): Promise<VipLinkResult> {
  try {
    if (!(await findLink(id))) return { ok: false, error: "notFound" };
    if (!(await approve(id, byName))) return { ok: false, error: "alreadyApproved" };
    await reloadBotModule("twitchvip");
    return { ok: true };
  } catch (error) {
    console.error("[twitchvip] approving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Takes the role off through the bot, then forgets the link. If the bot can't be reached the link stays, so nobody keeps a role without a link. */
export async function removeVipLink(id: string): Promise<VipLinkResult> {
  try {
    if (!(await findLink(id))) return { ok: true };
    const status = await unlinkTwitchVipViaBot(id);
    if (status === null) return { ok: false, error: "botUnavailable" };
    return status === "done" ? { ok: true } : { ok: false, error: "failed" };
  } catch (error) {
    console.error("[twitchvip] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
