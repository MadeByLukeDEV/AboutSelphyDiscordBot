import "server-only";
// Private to the roles module: only service.ts imports this.
import { prisma, type RolePanel, type RolePanelRole } from "@aboutselphy/db";
import type { PanelRoleView } from "./schema";

export type PanelWithRoles = RolePanel & { roles: RolePanelRole[] };

export function listPanels(): Promise<PanelWithRoles[]> {
  return prisma.rolePanel.findMany({ orderBy: { createdAt: "desc" }, include: { roles: { orderBy: { position: "asc" } } }, take: 100 });
}

export function findPanel(id: string): Promise<PanelWithRoles | null> {
  return prisma.rolePanel.findUnique({ where: { id }, include: { roles: { orderBy: { position: "asc" } } } });
}

export type PanelData = {
  channelId: string;
  title: string;
  description: string;
  color: number;
  style: "buttons" | "menu" | "reactions";
  exclusive: boolean;
};

const roleRows = (roles: PanelRoleView[]) => roles.map((r, position) => ({ ...r, position }));

export function createPanel(data: PanelData, roles: PanelRoleView[], createdByName: string): Promise<PanelWithRoles> {
  return prisma.rolePanel.create({
    data: { ...data, createdByName: createdByName.slice(0, 100), roles: { create: roleRows(roles) } },
    include: { roles: { orderBy: { position: "asc" } } },
  });
}

/** Replaces the panel's fields and its whole role list in one transaction. */
export function updatePanel(id: string, data: PanelData, roles: PanelRoleView[]): Promise<PanelWithRoles> {
  return prisma.$transaction(async (tx) => {
    await tx.rolePanelRole.deleteMany({ where: { panelId: id } });
    return tx.rolePanel.update({
      where: { id },
      data: { ...data, roles: { create: roleRows(roles) } },
      include: { roles: { orderBy: { position: "asc" } } },
    });
  });
}

export async function deletePanel(id: string): Promise<boolean> {
  return (await prisma.rolePanel.deleteMany({ where: { id } })).count > 0;
}
