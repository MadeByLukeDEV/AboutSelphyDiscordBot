// Private to the statchannels module: only service.ts imports this.
import { prisma, type StatChannel } from "@aboutselphy/db";

export const listStatChannels = (): Promise<StatChannel[]> => prisma.statChannel.findMany({ orderBy: { createdAt: "asc" } });

export const rememberName = (id: string, lastName: string) => prisma.statChannel.updateMany({ where: { id }, data: { lastName: lastName.slice(0, 100) } });

/** The channel was deleted in Discord: forget the row. */
export const deleteByChannel = (channelId: string) => prisma.statChannel.deleteMany({ where: { channelId } });
