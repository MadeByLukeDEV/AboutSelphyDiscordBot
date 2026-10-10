import "server-only";
// Private to the logs module: only service.ts imports this.
import { prisma, type LogRoute } from "@aboutselphy/db";
import type { LogCategory } from "@aboutselphy/shared/logs";

export function listRoutes(): Promise<LogRoute[]> {
  return prisma.logRoute.findMany();
}

/** Writes every category in one transaction, so the settings are never half saved. */
export function saveRoutes(routes: Array<{ category: LogCategory; enabled: boolean; channelId: string | null }>): Promise<unknown> {
  return prisma.$transaction(
    routes.map((r) =>
      prisma.logRoute.upsert({ where: { category: r.category }, update: { enabled: r.enabled, channelId: r.channelId }, create: r }),
    ),
  );
}
