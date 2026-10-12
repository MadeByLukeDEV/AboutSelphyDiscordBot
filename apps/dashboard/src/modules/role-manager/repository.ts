import "server-only";
// Private to the role-manager module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";
import type { UsageKey } from "./schema";

export type RoleReference = { key: UsageKey; roleId: string };

/** Every place another feature points at a role. */
export async function references(): Promise<RoleReference[]> {
  const refs: RoleReference[] = [];
  const add = (key: UsageKey, ids: Array<string | null | undefined>) => {
    for (const roleId of ids) if (roleId) refs.push({ key, roleId });
  };
  const [panels, rewards, welcome, levels, tickets, giveaways, announcements, streamers, twitch, youtube, birthday, ticketTypes] = await Promise.all([
    prisma.rolePanelRole.findMany({ select: { roleId: true } }),
    prisma.levelReward.findMany({ select: { roleId: true } }),
    prisma.welcomeConfig.findMany({ select: { autoRoleIds: true, botAutoRoleIds: true } }),
    prisma.levelConfig.findMany({ select: { noXpRoleIds: true } }),
    prisma.ticketConfig.findMany({ select: { staffRoleIds: true } }),
    prisma.giveaway.findMany({ where: { status: { in: ["draft", "active"] } }, select: { requiredRoleId: true, pingRoleId: true, bonusRoleId: true } }),
    prisma.announcement.findMany({ where: { status: { in: ["draft", "scheduled"] } }, select: { pingRoleId: true } }),
    prisma.twitchStreamer.findMany({ select: { pingRoleId: true } }),
    prisma.twitchConfig.findMany({ select: { liveRoleId: true } }),
    prisma.youtubeConfig.findMany({ select: { pingRoleId: true } }),
    prisma.birthdayConfig.findMany({ select: { roleId: true } }),
    prisma.ticketCategory.findMany({ select: { staffRoleIds: true } }),
  ]);
  add("panel", panels.map((p) => p.roleId));
  add("levelReward", rewards.map((r) => r.roleId));
  add("welcome", welcome.flatMap((w) => [...w.autoRoleIds, ...w.botAutoRoleIds]));
  add("noXp", levels.flatMap((l) => l.noXpRoleIds));
  add("tickets", [...tickets.flatMap((t) => t.staffRoleIds), ...ticketTypes.flatMap((t) => t.staffRoleIds)]);
  add("giveaway", giveaways.flatMap((g) => [g.requiredRoleId, g.pingRoleId, g.bonusRoleId]));
  add("announcement", announcements.map((a) => a.pingRoleId));
  add("twitch", [...streamers.map((s) => s.pingRoleId), ...twitch.map((c) => c.liveRoleId)]);
  add("youtube", youtube.map((y) => y.pingRoleId));
  add("birthday", birthday.map((b) => b.roleId));
  return refs;
}

/**
 * Removes every reference to the given (no longer existing) roles. Settings that would be left
 * invalid are switched off instead (tickets without staff, birthdays without a channel or role).
 * Returns how many references were removed per feature.
 */
export async function removeReferences(missing: string[]): Promise<Partial<Record<UsageKey, number>>> {
  const gone = new Set(missing);
  const removed: Partial<Record<UsageKey, number>> = {};
  const count = (key: UsageKey, n: number) => {
    if (n > 0) removed[key] = (removed[key] ?? 0) + n;
  };
  const keep = (ids: string[]) => ids.filter((id) => !gone.has(id));

  const [welcome, levels, tickets] = await Promise.all([prisma.welcomeConfig.findMany(), prisma.levelConfig.findMany(), prisma.ticketConfig.findMany()]);

  await prisma.$transaction(async (tx) => {
    count("panel", (await tx.rolePanelRole.deleteMany({ where: { roleId: { in: missing } } })).count);
    count("levelReward", (await tx.levelReward.deleteMany({ where: { roleId: { in: missing } } })).count);
    for (const w of welcome) {
      const auto = keep(w.autoRoleIds);
      const botAuto = keep(w.botAutoRoleIds);
      const n = w.autoRoleIds.length - auto.length + (w.botAutoRoleIds.length - botAuto.length);
      if (n > 0) {
        await tx.welcomeConfig.update({ where: { id: w.id }, data: { autoRoleIds: auto, botAutoRoleIds: botAuto } });
        count("welcome", n);
      }
    }
    for (const l of levels) {
      const next = keep(l.noXpRoleIds);
      if (next.length !== l.noXpRoleIds.length) {
        await tx.levelConfig.update({ where: { id: l.id }, data: { noXpRoleIds: next } });
        count("noXp", l.noXpRoleIds.length - next.length);
      }
    }
    // A ticket type that loses all its own roles falls back to the general staff roles.
    for (const c of await tx.ticketCategory.findMany()) {
      const next = keep(c.staffRoleIds);
      if (next.length !== c.staffRoleIds.length) {
        await tx.ticketCategory.update({ where: { id: c.id }, data: { staffRoleIds: next } });
        count("tickets", c.staffRoleIds.length - next.length);
      }
    }
    for (const t of tickets) {
      const next = keep(t.staffRoleIds);
      if (next.length !== t.staffRoleIds.length) {
        // A ticket system needs at least one staff role: without one it is switched off.
        await tx.ticketConfig.update({ where: { id: t.id }, data: { staffRoleIds: next, ...(next.length === 0 ? { enabled: false } : {}) } });
        count("tickets", t.staffRoleIds.length - next.length);
      }
    }
    count("giveaway", (await tx.giveaway.updateMany({ where: { requiredRoleId: { in: missing } }, data: { requiredRoleId: null } })).count + (await tx.giveaway.updateMany({ where: { pingRoleId: { in: missing } }, data: { pingRoleId: null } })).count + (await tx.giveaway.updateMany({ where: { bonusRoleId: { in: missing } }, data: { bonusRoleId: null, bonusEntries: 0 } })).count);
    count("announcement", (await tx.announcement.updateMany({ where: { pingRoleId: { in: missing } }, data: { pingRoleId: null } })).count);
    count("twitch", (await tx.twitchStreamer.updateMany({ where: { pingRoleId: { in: missing } }, data: { pingRoleId: null } })).count + (await tx.twitchConfig.updateMany({ where: { liveRoleId: { in: missing } }, data: { liveRoleId: null } })).count);
    count("youtube", (await tx.youtubeConfig.updateMany({ where: { pingRoleId: { in: missing } }, data: { pingRoleId: null } })).count);
    const birthdays = await tx.birthdayConfig.findMany({ where: { roleId: { in: missing } } });
    for (const b of birthdays) {
      await tx.birthdayConfig.update({ where: { id: b.id }, data: { roleId: null, ...(b.channelId === null ? { enabled: false } : {}) } });
      count("birthday", 1);
    }
  });
  return removed;
}
