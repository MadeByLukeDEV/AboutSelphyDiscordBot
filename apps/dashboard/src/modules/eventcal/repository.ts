import "server-only";
// Private to the eventcal module: only service.ts imports this.
import { prisma, type EventCalendarConfig, type EventRule } from "@aboutselphy/db";

export const readConfig = (): Promise<EventCalendarConfig> => prisma.eventCalendarConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export function updateConfig(data: { enabled: boolean; icsUrl: string; overviewChannelId: string | null; overviewDays: number; summaryChannelId: string | null; baselined?: false }): Promise<EventCalendarConfig> {
  return prisma.eventCalendarConfig.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
}

export const listPostedEvents = () => prisma.eventPost.findMany({ where: { messageId: { not: null } }, orderBy: { startsAt: "desc" }, take: 15, include: { rule: { select: { name: true } } } });

export const listArticles = () => prisma.eventArticle.findMany({ orderBy: { createdAt: "desc" }, take: 40 });

/** Saves an article, replacing an earlier one of the same month, and keeps only the newest four. */
export async function saveArticle(data: { monthKey: string; title: string; text: string; importedByName: string; sourceId: string | null }): Promise<void> {
  await prisma.$transaction([prisma.eventArticle.deleteMany({ where: { monthKey: data.monthKey, sourceId: data.sourceId } }), prisma.eventArticle.create({ data })]);
  const old = await prisma.eventArticle.findMany({ where: { sourceId: data.sourceId }, orderBy: { createdAt: "desc" }, skip: 4, select: { id: true } });
  if (old.length > 0) await prisma.eventArticle.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

export const deleteArticle = async (id: string) => (await prisma.eventArticle.deleteMany({ where: { id } })).count;

export const listRules = (): Promise<EventRule[]> => prisma.eventRule.findMany({ orderBy: { createdAt: "asc" } });
export const countRules = () => prisma.eventRule.count();
export const findRule = (id: string) => prisma.eventRule.findUnique({ where: { id } });

type RuleData = { name: string; words: string[]; categories: string[]; channelId: string; pingRoleId: string | null; daysAhead: number; useAi: boolean; enabled: boolean; sourceId: string | null };
export const createRule = (data: RuleData) => prisma.eventRule.create({ data });
/** A changed match or channel starts over for the rule: its next check only remembers what matches. */
export const updateRule = (id: string, data: RuleData, reseed: boolean) => prisma.eventRule.update({ where: { id }, data: { ...data, ...(reseed ? { seeded: false } : {}) } });
export const deleteRule = async (id: string) => (await prisma.eventRule.deleteMany({ where: { id } })).count;

export const listSources = () => prisma.eventSource.findMany({ orderBy: { createdAt: "asc" } });
export const countSources = () => prisma.eventSource.count();
export const findSource = (id: string) => prisma.eventSource.findUnique({ where: { id } });
type SourceData = { name: string; enabled: boolean; overviewChannelId: string | null; overviewDays: number; summaryChannelId: string | null };
export const createSource = (data: SourceData) => prisma.eventSource.create({ data });
export const updateSource = (id: string, data: SourceData) => prisma.eventSource.update({ where: { id }, data });
export const deleteSource = async (id: string) => (await prisma.eventSource.deleteMany({ where: { id } })).count;
