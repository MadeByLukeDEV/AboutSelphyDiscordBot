// Private to the welcome module: only config.ts and events.ts import this.
import { prisma, type WelcomeConfig } from "@aboutselphy/db";

export function readConfig(): Promise<WelcomeConfig> {
  return prisma.welcomeConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function saveSnapshot(userId: string, roleIds: string[]) {
  return prisma.memberRoleSnapshot.upsert({ where: { userId }, update: { roleIds, savedAt: new Date() }, create: { userId, roleIds } });
}

export async function takeSnapshot(userId: string): Promise<string[]> {
  const row = await prisma.memberRoleSnapshot.findUnique({ where: { userId } });
  return row?.roleIds ?? [];
}

export function deleteSnapshot(userId: string) {
  return prisma.memberRoleSnapshot.deleteMany({ where: { userId } });
}

/** Snapshots are personal data: they are kept for a limited time only. */
export async function pruneSnapshots(olderThan: Date): Promise<number> {
  return (await prisma.memberRoleSnapshot.deleteMany({ where: { savedAt: { lt: olderThan } } })).count;
}

/** The image the admin uploaded for the card, or null. */
export async function readCardImage(): Promise<Uint8Array | null> {
  const row = await prisma.welcomeCardImage.findUnique({ where: { id: 1 } });
  return row ? new Uint8Array(row.data) : null;
}
