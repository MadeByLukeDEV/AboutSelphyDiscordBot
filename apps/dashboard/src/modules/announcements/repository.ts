import "server-only";
// Private to the announcements module: only service.ts imports this.
import { prisma, type Announcement, type AnnouncementStatus } from "@aboutselphy/db";

export type AnnouncementData = {
  content: string;
  embedEnabled: boolean;
  embedTitle: string;
  embedDescription: string;
  embedColor: number;
  embedImageUrl: string;
  channelId: string;
  pingRoleId: string | null;
  status: AnnouncementStatus;
  scheduledFor: Date | null;
};

export function listAnnouncements(take = 100): Promise<Announcement[]> {
  return prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take });
}

export function findAnnouncement(id: string): Promise<Announcement | null> {
  return prisma.announcement.findUnique({ where: { id } });
}

export function createAnnouncement(data: AnnouncementData, by: { userId: string; name: string }): Promise<Announcement> {
  return prisma.announcement.create({ data: { ...data, lastError: "", createdByUserId: by.userId, createdByName: by.name.slice(0, 100) } });
}

/**
 * Changes an announcement that is not being sent right now. The status condition is
 * part of the UPDATE, so an edit can't overwrite a row the bot has just claimed.
 * Returns the row, or null when it changed under us.
 */
export async function updateAnnouncement(id: string, data: Partial<AnnouncementData>, allowedFrom: AnnouncementStatus[]): Promise<Announcement | null> {
  const { count } = await prisma.announcement.updateMany({ where: { id, status: { in: allowedFrom } }, data: { ...data, lastError: "" } });
  return count === 0 ? null : prisma.announcement.findUnique({ where: { id } });
}

/** Deletes a row that isn't being sent right now. */
export async function deleteAnnouncementRow(id: string): Promise<boolean> {
  const { count } = await prisma.announcement.deleteMany({ where: { id, status: { not: "sending" } } });
  return count > 0;
}
