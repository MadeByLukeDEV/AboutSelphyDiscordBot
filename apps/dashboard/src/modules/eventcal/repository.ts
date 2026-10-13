import "server-only";
// Private to the eventcal module: only service.ts imports this.
import { prisma, type EventCalendarConfig, type EventRule } from "@aboutselphy/db";

export const readConfig = (): Promise<EventCalendarConfig> => prisma.eventCalendarConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateConfig(data: { enabled: boolean; icsUrl: string; overviewChannelId: string | null; overviewDays: number; baselined?: false }): Promise<EventCalendarConfig> {
  return prisma.eventCalendarConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

export const listRules = (): Promise<EventRule[]> => prisma.eventRule.findMany({ orderBy: { createdAt: "asc" } });
export const countRules = () => prisma.eventRule.count();
export const findRule = (id: string) => prisma.eventRule.findUnique({ where: { id } });

type RuleData = { name: string; words: string[]; categories: string[]; channelId: string; pingRoleId: string | null; daysAhead: number; enabled: boolean };
export const createRule = (data: RuleData) => prisma.eventRule.create({ data });
/** A changed match or channel starts over for the rule: its next check only remembers what matches. */
export const updateRule = (id: string, data: RuleData, reseed: boolean) => prisma.eventRule.update({ where: { id }, data: { ...data, ...(reseed ? { seeded: false } : {}) } });
export const deleteRule = async (id: string) => (await prisma.eventRule.deleteMany({ where: { id } })).count;
