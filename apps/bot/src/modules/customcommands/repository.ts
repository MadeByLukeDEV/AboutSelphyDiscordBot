// Private to the customcommands module: only service.ts and commands.ts import this.
import { prisma, type CustomCommand } from "@aboutselphy/db";

export const listEnabled = (): Promise<CustomCommand[]> => prisma.customCommand.findMany({ where: { enabled: true }, orderBy: { name: "asc" } });
export const findEnabled = (name: string): Promise<CustomCommand | null> => prisma.customCommand.findFirst({ where: { name, enabled: true } });
export const countUse = (id: string) => prisma.customCommand.updateMany({ where: { id }, data: { uses: { increment: 1 } } });
