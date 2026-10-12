import "server-only";
import { counts, recentJoins, topInviters } from "./repository";

export type JoinRow = { id: string; userId: string; userName: string; inviterId: string | null; inviterName: string | null; code: string | null; source: string; joinedAt: string; left: boolean };

/** Totals, the top inviters and the latest 50 joins. */
export async function getInvitesPage() {
  const [totals, top, joins] = await Promise.all([counts(), topInviters(15), recentJoins(50)]);
  const rows: JoinRow[] = joins.map((j) => ({ id: j.id, userId: j.userId, userName: j.userName, inviterId: j.inviterId, inviterName: j.inviterName, code: j.code, source: j.source, joinedAt: j.joinedAt.toISOString(), left: j.leftAt !== null }));
  return { totals, top, rows };
}
