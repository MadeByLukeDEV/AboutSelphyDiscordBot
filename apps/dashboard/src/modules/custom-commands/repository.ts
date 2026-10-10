import "server-only";
// Private to the custom-commands module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";

export const listCommands = () => prisma.customCommand.findMany({ orderBy: { name: "asc" } });
export const findCommand = (id: string) => prisma.customCommand.findUnique({ where: { id } });
export const findByName = (name: string) => prisma.customCommand.findUnique({ where: { name } });
export const countCommands = () => prisma.customCommand.count();
export const createCommand = (data: { name: string; response: string; ephemeral: boolean; enabled: boolean; createdByName: string }) => prisma.customCommand.create({ data });
export const updateCommand = (id: string, data: { response: string; ephemeral: boolean; enabled: boolean }) => prisma.customCommand.update({ where: { id }, data });
export const deleteCommand = async (id: string) => (await prisma.customCommand.deleteMany({ where: { id } })).count;
