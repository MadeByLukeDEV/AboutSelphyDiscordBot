import "server-only";
// Private to the games module: only service.ts imports this.
import { prisma, type GameConfig } from "@aboutselphy/db";
import type { StatGame } from "@aboutselphy/shared/games";

export const readConfig = (): Promise<GameConfig> => prisma.gameConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

type ConfigData = { winXp: number; dailyXpCap: number; cooldownSeconds: number; allowedChannelIds: string[]; triviaOn: boolean; rpsOn: boolean; tictactoeOn: boolean; connect4On: boolean; funOn: boolean };
export const updateConfig = (data: ConfigData): Promise<GameConfig> => prisma.gameConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });

export const topOf = (game: StatGame, take = 5) => prisma.gameStat.findMany({ where: { game, wins: { gt: 0 } }, orderBy: [{ wins: "desc" }, { played: "asc" }], take, select: { userId: true, name: true, wins: true, played: true } });
