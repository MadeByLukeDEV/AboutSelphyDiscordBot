import "server-only";
// Private to the role-manager module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";
import type { UsageKey } from "./schema";

/** Which roles other features still point at, so deleting them is a conscious choice. */
export async function roleUsage(): Promise<Map<string, Set<UsageKey>>> {
  const usage = new Map<string, Set<UsageKey>>();
  const add = (key: UsageKey, ids: Array<string | null | undefined>) => {
    for (const id of ids) {
      if (!id) continue;
      if (!usage.has(id)) usage.set(id, new Set());
      usage.get(id)!.add(key);
    }
  };
  const [panels, rewards, welcome, levels, tickets, giveaways, announcements, streamers, youtube, birthday] = await Promise.all([
    prisma.rolePanelRole.findMany({ select: { roleId: true } }),
    prisma.levelReward.findMany({ select: { roleId: true } }),
    prisma.welcomeConfig.findMany({ select: { autoRoleIds: true, botAutoRoleIds: true } }),
    prisma.levelConfig.findMany({ select: { noXpRoleIds: true } }),
    prisma.ticketConfig.findMany({ select: { staffRoleIds: true } }),
    prisma.giveaway.findMany({ where: { status: { in: ["draft", "active"] } }, select: { requiredRoleId: true, pingRoleId: true } }),
    prisma.announcement.findMany({ where: { status: { in: ["draft", "scheduled"] } }, select: { pingRoleId: true } }),
    prisma.twitchStreamer.findMany({ select: { pingRoleId: true } }),
    prisma.youtubeConfig.findMany({ select: { pingRoleId: true } }),
    prisma.birthdayConfig.findMany({ select: { roleId: true } }),
  ]);
  add("panel", panels.map((p) => p.roleId));
  add("levelReward", rewards.map((r) => r.roleId));
  add("welcome", welcome.flatMap((w) => [...w.autoRoleIds, ...w.botAutoRoleIds]));
  add("noXp", levels.flatMap((l) => l.noXpRoleIds));
  add("tickets", tickets.flatMap((t) => t.staffRoleIds));
  add("giveaway", giveaways.flatMap((g) => [g.requiredRoleId, g.pingRoleId]));
  add("announcement", announcements.map((a) => a.pingRoleId));
  add("twitch", streamers.map((s) => s.pingRoleId));
  add("youtube", youtube.map((y) => y.pingRoleId));
  add("birthday", birthday.map((b) => b.roleId));
  return usage;
}
