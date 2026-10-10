// Private to the autoresponders module: only service.ts imports this.
import { prisma, type AutoResponder } from "@aboutselphy/db";

export const listEnabled = (): Promise<AutoResponder[]> => prisma.autoResponder.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
export const countUse = (id: string) => prisma.autoResponder.updateMany({ where: { id }, data: { uses: { increment: 1 } } });
