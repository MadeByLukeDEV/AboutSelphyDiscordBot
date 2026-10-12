import "server-only";
// Private to the audit module: audited.ts and service.ts import this.
import { prisma } from "@aboutselphy/db";

export type EntryInput = { actorId: string; actorName: string; actorRole: string; area: string; action: string; target: string };

export const recordEntry = (e: EntryInput) =>
  prisma.auditEntry.create({ data: { actorId: e.actorId.slice(0, 64), actorName: e.actorName.slice(0, 100), actorRole: e.actorRole.slice(0, 16), area: e.area.slice(0, 40), action: e.action.slice(0, 60), target: e.target.slice(0, 64) } });

export const listEntries = (take: number, area: string | null) => prisma.auditEntry.findMany({ where: area ? { area } : {}, orderBy: { at: "desc" }, take });

export const listAreas = async () => (await prisma.auditEntry.groupBy({ by: ["area"], _count: { _all: true }, orderBy: { area: "asc" } })).map((r) => r.area);
