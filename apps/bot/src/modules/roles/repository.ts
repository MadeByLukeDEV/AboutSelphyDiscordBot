// Private to the roles module: only service.ts and interactions.ts import this.
import { prisma } from "@aboutselphy/db";

export function findPanel(id: string) {
  return prisma.rolePanel.findUnique({ where: { id }, include: { roles: { orderBy: { position: "asc" } } } });
}

export function setPanelMessage(id: string, messageId: string | null) {
  return prisma.rolePanel.update({ where: { id }, data: { messageId } });
}
