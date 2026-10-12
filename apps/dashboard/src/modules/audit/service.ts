import "server-only";
import { listAreas, listEntries } from "./repository";

export type AuditRow = { id: string; at: string; actorName: string; actorRole: string; area: string; action: string; target: string };

/** The newest 200 entries (optionally of one area) and the areas that have any. */
export async function getAuditPage(area: string | null) {
  const [rows, areas] = await Promise.all([listEntries(200, area), listAreas()]);
  const entries: AuditRow[] = rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actorName: r.actorName, actorRole: r.actorRole, area: r.area, action: r.action, target: r.target }));
  return { entries, areas };
}
