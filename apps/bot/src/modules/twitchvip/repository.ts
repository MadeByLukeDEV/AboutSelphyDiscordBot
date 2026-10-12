// Private to the twitchvip module: only service.ts, config.ts and commands.ts import this.
import { prisma, type TwitchVipConfig, type TwitchVipLink } from "@aboutselphy/db";

export const readConfig = (): Promise<TwitchVipConfig> => prisma.twitchVipConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const recordSync = (status: string, vipCount: number) => prisma.twitchVipConfig.update({ where: { id: 1 }, data: { status, vipCount, lastSyncAt: new Date() } });

export const listApproved = (): Promise<TwitchVipLink[]> => prisma.twitchVipLink.findMany({ where: { approved: true } });
export const findByDiscord = (discordUserId: string): Promise<TwitchVipLink | null> => prisma.twitchVipLink.findUnique({ where: { discordUserId } });
export const findById = (id: string): Promise<TwitchVipLink | null> => prisma.twitchVipLink.findUnique({ where: { id } });
export const findByTwitch = (twitchUserId: string): Promise<TwitchVipLink | null> => prisma.twitchVipLink.findUnique({ where: { twitchUserId } });
export const countLinks = () => prisma.twitchVipLink.count();

/** A new claim, always pending. */
export const createLink = (data: { discordUserId: string; discordName: string; twitchUserId: string; twitchLogin: string }) => prisma.twitchVipLink.create({ data: { ...data, approved: false } });

export const deleteLink = async (id: string) => (await prisma.twitchVipLink.deleteMany({ where: { id } })).count > 0;
export const deleteByDiscord = async (discordUserId: string) => (await prisma.twitchVipLink.deleteMany({ where: { discordUserId } })).count;
