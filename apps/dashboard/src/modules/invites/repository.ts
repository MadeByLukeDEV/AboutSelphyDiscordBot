import "server-only";
// Private to the invites module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

export const recentJoins = (take: number) => prisma.memberInvite.findMany({ orderBy: { joinedAt: "desc" }, take });

export async function counts() {
  const [total, viaInvite, viaVanity, unknown, here] = await Promise.all([
    prisma.memberInvite.count(),
    prisma.memberInvite.count({ where: { source: "invite" } }),
    prisma.memberInvite.count({ where: { source: "vanity" } }),
    prisma.memberInvite.count({ where: { source: "unknown" } }),
    prisma.memberInvite.count({ where: { leftAt: null } }),
  ]);
  return { total, viaInvite, viaVanity, unknown, here };
}

/** The members who brought the most people, with how many of them are still here. */
export async function topInviters(take: number) {
  const top = await prisma.memberInvite.groupBy({ by: ["inviterId"], where: { inviterId: { not: null } }, _count: { _all: true }, orderBy: { _count: { inviterId: "desc" } }, take });
  const ids = top.map((t) => t.inviterId).filter((id): id is string => id !== null);
  if (ids.length === 0) return [];
  const [stillHere, names] = await Promise.all([
    prisma.memberInvite.groupBy({ by: ["inviterId"], where: { inviterId: { in: ids }, leftAt: null }, _count: { _all: true } }),
    prisma.memberInvite.findMany({ where: { inviterId: { in: ids } }, orderBy: { joinedAt: "desc" }, distinct: ["inviterId"], select: { inviterId: true, inviterName: true } }),
  ]);
  const here = new Map(stillHere.map((r) => [r.inviterId, r._count._all]));
  const name = new Map(names.map((n) => [n.inviterId, n.inviterName]));
  return top.map((t) => ({ inviterId: t.inviterId!, name: name.get(t.inviterId) ?? null, total: t._count._all, here: here.get(t.inviterId) ?? 0 }));
}
