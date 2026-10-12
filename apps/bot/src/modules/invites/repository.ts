// Private to the invites module: only service.ts and commands.ts import this.
import { prisma } from "@aboutselphy/db";

export type JoinRecord = { userId: string; userName: string; inviterId: string | null; inviterName: string | null; code: string | null; source: "invite" | "vanity" | "unknown" };

export const recordJoin = (j: JoinRecord) => prisma.memberInvite.create({ data: { ...j, userName: j.userName.slice(0, 100), inviterName: j.inviterName?.slice(0, 100) ?? null } });

/** The member left: their newest open join row gets a leave time. */
export async function markLeft(userId: string): Promise<void> {
  const row = await prisma.memberInvite.findFirst({ where: { userId, leftAt: null }, orderBy: { joinedAt: "desc" }, select: { id: true } });
  if (row) await prisma.memberInvite.update({ where: { id: row.id }, data: { leftAt: new Date() } });
}

/** How many people joined through this member's invites, and how many of them are still here. */
export async function statsFor(inviterId: string): Promise<{ total: number; here: number }> {
  const [total, here] = await Promise.all([prisma.memberInvite.count({ where: { inviterId } }), prisma.memberInvite.count({ where: { inviterId, leftAt: null } })]);
  return { total, here };
}
