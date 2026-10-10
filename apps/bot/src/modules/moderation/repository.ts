// Private to the moderation module: only service.ts imports this.
import { prisma, type ModCase, type ModCaseSource, type ModCaseType, type ModConfig } from "@aboutselphy/db";

export type NewCase = {
  type: ModCaseType;
  source: ModCaseSource;
  targetId: string;
  targetName: string | null;
  moderatorId: string;
  moderatorName: string | null;
  reason: string | null;
  durationSeconds?: number | null;
  expiresAt?: Date | null;
};

/**
 * Inserts a case with the next number. The counter lives on the singleton
 * ModConfig row and is incremented in the same transaction, so two concurrent
 * actions can never get the same number (and numbers are never reused).
 */
export async function createCase(input: NewCase): Promise<ModCase> {
  return prisma.$transaction(async (tx) => {
    const { nextCaseNumber } = await tx.modConfig.update({
      where: { id: 1 },
      data: { nextCaseNumber: { increment: 1 } },
      select: { nextCaseNumber: true },
    });
    return tx.modCase.create({
      data: {
        ...input,
        durationSeconds: input.durationSeconds ?? null,
        expiresAt: input.expiresAt ?? null,
        caseNumber: nextCaseNumber - 1,
      },
    });
  });
}

export function setCaseLogMessage(id: string, channelId: string, messageId: string) {
  return prisma.modCase.update({ where: { id }, data: { logChannelId: channelId, logMessageId: messageId } });
}

export function findCaseByNumber(caseNumber: number) {
  return prisma.modCase.findUnique({ where: { caseNumber } });
}

export function listCasesForTarget(targetId: string, take: number) {
  return prisma.modCase.findMany({ where: { targetId }, orderBy: { createdAt: "desc" }, take });
}

export async function countCasesByType(targetId: string) {
  const rows = await prisma.modCase.groupBy({
    by: ["type", "active"],
    where: { targetId },
    _count: { _all: true },
  });
  return rows.map((r) => ({ type: r.type, active: r.active, count: r._count._all }));
}

export function readConfig(): Promise<ModConfig> {
  return prisma.modConfig.findUniqueOrThrow({ where: { id: 1 } });
}

export type ConfigUpdate = Partial<
  Pick<ModConfig, "logChannelId" | "dmOnAction" | "escalationThreshold" | "escalationAction" | "escalationDurationSeconds">
>;

export function updateConfig(data: ConfigUpdate) {
  return prisma.modConfig.update({ where: { id: 1 }, data });
}

/** Warnings that haven't been pardoned. */
export function countActiveWarnings(targetId: string): Promise<number> {
  return prisma.modCase.count({ where: { targetId, type: "warn", active: true } });
}

// -- temporary bans ------------------------------------------------------------------

/** Bans whose time is up and that nobody has lifted yet. */
export function listDueBans(now: Date, take = 25): Promise<ModCase[]> {
  return prisma.modCase.findMany({
    where: { type: "ban", expiresAt: { lte: now }, expiryHandledAt: null },
    orderBy: { expiresAt: "asc" },
    take,
  });
}

/** Marks the expiry as taken care of. False if someone else (another process) got there first. */
export async function claimExpiry(id: string, at: Date): Promise<boolean> {
  const { count } = await prisma.modCase.updateMany({ where: { id, expiryHandledAt: null }, data: { expiryHandledAt: at } });
  return count > 0;
}

/** Gives the claim back after a failed attempt, so the next round tries again. */
export function releaseExpiry(id: string) {
  return prisma.modCase.updateMany({ where: { id }, data: { expiryHandledAt: null } });
}
