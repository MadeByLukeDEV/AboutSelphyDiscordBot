// Private to the sticky module: only service.ts imports this.
import { prisma, type StickyMessage } from "@aboutselphy/db";

export const listStickies = (): Promise<StickyMessage[]> => prisma.stickyMessage.findMany();
export const findByChannel = (channelId: string): Promise<StickyMessage | null> => prisma.stickyMessage.findUnique({ where: { channelId } });
export const listDirty = (): Promise<StickyMessage[]> => prisma.stickyMessage.findMany({ where: { dirty: true } });

/** Remembers the copy now at the bottom (or none) and marks the row as up to date. */
export const setPosted = (id: string, lastMessageId: string | null) => prisma.stickyMessage.updateMany({ where: { id }, data: { lastMessageId, dirty: false } });
