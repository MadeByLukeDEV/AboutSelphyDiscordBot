import "server-only";
import { levelFromXp, type LevelSettings } from "@aboutselphy/shared/levels";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { countMembers, readConfig, saveAll, topMembers } from "./repository";
import type { LeaderboardRow, SaveLevelsResult } from "./schema";

async function readSettings(): Promise<LevelSettings> {
  const { config: c, rewards } = await readConfig();
  return {
    enabled: c.enabled,
    xpMin: c.xpMin,
    xpMax: c.xpMax,
    cooldownSeconds: c.cooldownSeconds,
    voiceXpPerMinute: c.voiceXpPerMinute,
    announce: c.announce === "off" || c.announce === "channel" ? c.announce : "same",
    announceChannelId: c.announceChannelId ?? "",
    announceTemplate: c.announceTemplate,
    noXpChannelIds: c.noXpChannelIds,
    noXpRoleIds: c.noXpRoleIds,
    stackRoles: c.stackRoles,
    rewards: rewards.map((r) => ({ level: r.level, roleId: r.roleId })),
  };
}

/** Settings, the top 25 members, how many have XP, and the channels and roles to pick from (null = bot unreachable). */
export async function getLevelsPage() {
  const [settings, top, total, channels, roles] = await Promise.all([readSettings(), topMembers(25), countMembers(), listChannels(["text", "voice", "category"]), listRoles()]);
  const leaderboard: LeaderboardRow[] = top.map((m) => ({ userId: m.userId, name: m.name || m.userId, xp: m.xp, level: levelFromXp(m.xp), messages: m.messages, voiceMinutes: m.voiceMinutes }));
  return { settings, leaderboard, total, channels, roles };
}

/**
 * Saves the settings and rewards. New channels and roles are checked against the server through
 * the bot (refused if it can't answer); a reward role must be one the bot may hand out. Saved ones
 * need no lookup, so a settings change still works while the bot is down. The bot checks every
 * reward role again whenever it gives it.
 */
export async function saveLevels(input: LevelSettings): Promise<SaveLevelsResult> {
  try {
    const current = await readSettings();
    const newChannels = [...input.noXpChannelIds, input.announceChannelId].filter((id) => id && id !== current.announceChannelId && !current.noXpChannelIds.includes(id));
    const newRoles = [...input.noXpRoleIds.filter((id) => !current.noXpRoleIds.includes(id)), ...input.rewards.map((r) => r.roleId).filter((id) => !current.rewards.some((r) => r.roleId === id))];
    const rewardRoleIds = new Set(input.rewards.map((r) => r.roleId));

    if (newChannels.length > 0) {
      const channels = await listChannels(["text", "voice", "category"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (newChannels.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    if (newRoles.length > 0) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      for (const id of newRoles) {
        const known = roles.find((r) => r.id === id);
        if (!known) return { ok: false, error: "roleNotFound" };
        if (rewardRoleIds.has(id) && !known.assignable) return { ok: false, error: "roleNotAllowed" };
      }
    }

    await saveAll(
      {
        enabled: input.enabled,
        xpMin: input.xpMin,
        xpMax: input.xpMax,
        cooldownSeconds: input.cooldownSeconds,
        voiceXpPerMinute: input.voiceXpPerMinute,
        announce: input.announce,
        announceChannelId: input.announceChannelId || null,
        announceTemplate: input.announceTemplate,
        noXpChannelIds: input.noXpChannelIds,
        noXpRoleIds: input.noXpRoleIds,
        stackRoles: input.stackRoles,
      },
      input.rewards,
    );
    return { ok: true, settings: await readSettings(), botNotified: await reloadBotModule("levels") };
  } catch (error) {
    console.error("[levels] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
