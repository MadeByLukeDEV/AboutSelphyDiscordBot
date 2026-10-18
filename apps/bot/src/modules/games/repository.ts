// Private to the games module: only service.ts and commands.ts import this.
import { prisma, type GameConfig } from "@aboutselphy/db";
import type { StatGame } from "@aboutselphy/shared/games";

export const readConfig = (): Promise<GameConfig> => prisma.gameConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export type Result = "win" | "draw" | "loss";

/** Adds one finished game to each player's record. */
export async function recordResults(game: StatGame, players: ReadonlyArray<{ userId: string; name: string; result: Result }>): Promise<void> {
  await prisma.$transaction(
    players.map((p) =>
      prisma.gameStat.upsert({
        where: { userId_game: { userId: p.userId, game } },
        create: { userId: p.userId, game, name: p.name.slice(0, 100), played: 1, wins: p.result === "win" ? 1 : 0, draws: p.result === "draw" ? 1 : 0 },
        update: { name: p.name.slice(0, 100), played: { increment: 1 }, wins: { increment: p.result === "win" ? 1 : 0 }, draws: { increment: p.result === "draw" ? 1 : 0 } },
      }),
    ),
  );
}

export const statsOf = (userId: string) => prisma.gameStat.findMany({ where: { userId }, orderBy: { game: "asc" } });

/** The best players of one game by wins (ties: fewer games played first), or of every game together. */
export async function topPlayers(game: StatGame | null, take = 10): Promise<Array<{ userId: string; name: string; wins: number; played: number }>> {
  if (game) return prisma.gameStat.findMany({ where: { game, wins: { gt: 0 } }, orderBy: [{ wins: "desc" }, { played: "asc" }], take, select: { userId: true, name: true, wins: true, played: true } });
  const rows = await prisma.gameStat.groupBy({ by: ["userId"], _sum: { wins: true, played: true }, having: { wins: { _sum: { gt: 0 } } }, orderBy: [{ _sum: { wins: "desc" } }, { _sum: { played: "asc" } }], take });
  const names = await prisma.gameStat.findMany({ where: { userId: { in: rows.map((r) => r.userId) } }, orderBy: { updatedAt: "desc" }, select: { userId: true, name: true } });
  const nameOf = new Map<string, string>();
  for (const n of names) if (!nameOf.has(n.userId)) nameOf.set(n.userId, n.name);
  return rows.map((r) => ({ userId: r.userId, name: nameOf.get(r.userId) ?? "", wins: r._sum.wins ?? 0, played: r._sum.played ?? 0 }));
}

/** The game XP a member already earned on `day`. */
export async function xpUsed(userId: string, day: string): Promise<number> {
  return (await prisma.gameXpDay.findUnique({ where: { userId_day: { userId, day } } }))?.xp ?? 0;
}

export async function addXpUsed(userId: string, day: string, amount: number): Promise<void> {
  await prisma.gameXpDay.upsert({ where: { userId_day: { userId, day } }, create: { userId, day, xp: amount }, update: { xp: { increment: amount } } });
}

/** Rows older than a week are not needed any more. */
export const pruneXpDays = (before: string) => prisma.gameXpDay.deleteMany({ where: { day: { lt: before } } });
