// Private to the productwatch module: only service.ts imports this.
import { prisma, type Prisma, type ProductWatch } from "@aboutselphy/db";
import type { Snapshot } from "./rules";

export const listEnabled = (): Promise<ProductWatch[]> => prisma.productWatch.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });

/** Records a look. `snapshot` is stored (and the watch counts as baselined) only when one is given. */
export function recordLook(id: string, status: string, snapshot?: { value: Snapshot; changed: boolean }) {
  return prisma.productWatch.updateMany({
    where: { id },
    data: {
      lastCheckedAt: new Date(),
      lastStatus: status.slice(0, 24),
      ...(snapshot ? { snapshot: snapshot.value as unknown as Prisma.InputJsonValue, baselined: true, ...(snapshot.changed ? { lastChangedAt: new Date() } : {}) } : {}),
    },
  });
}
