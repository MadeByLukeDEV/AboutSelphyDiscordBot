import "server-only";
// Private to the eventcal module: only service.ts imports this.
import { prisma, type EventRule } from "@aboutselphy/db";

export const listPostedEvents = () => prisma.eventPost.findMany({ where: { messageId: { not: null } }, orderBy: { startsAt: "desc" }, take: 15, include: { rule: { select: { name: true } } } });

export const listArticles = () => prisma.eventArticle.findMany({ where: { sourceId: { not: null } }, orderBy: { createdAt: "desc" }, take: 60 });

/** Saves an article, replacing an earlier one of the same month in that source, and keeps only the newest four per source. */
export async function saveArticle(data: { monthKey: string; title: string; text: string; importedByName: string; sourceId: string }): Promise<void> {
  await prisma.$transaction([prisma.eventArticle.deleteMany({ where: { monthKey: data.monthKey, sourceId: data.sourceId } }), prisma.eventArticle.create({ data })]);
  const old = await prisma.eventArticle.findMany({ where: { sourceId: data.sourceId }, orderBy: { createdAt: "desc" }, skip: 4, select: { id: true } });
  if (old.length > 0) await prisma.eventArticle.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
}

export const deleteArticle = async (id: string) => (await prisma.eventArticle.deleteMany({ where: { id } })).count;

export const listRules = (): Promise<EventRule[]> => prisma.eventRule.findMany({ orderBy: { createdAt: "asc" } });
export const countRules = () => prisma.eventRule.count();
export const findRule = (id: string) => prisma.eventRule.findUnique({ where: { id } });

type RuleData = { name: string; words: string[]; categories: string[]; kinds: string[]; channelId: string; pingRoleId: string | null; daysAhead: number; leadDays: number[]; useAi: boolean; enabled: boolean; sourceId: string };
export const createRule = (data: RuleData) => prisma.eventRule.create({ data });
/** A changed match or channel starts over for the rule: its next check only remembers what matches. */
export const updateRule = (id: string, data: RuleData, reseed: boolean) => prisma.eventRule.update({ where: { id }, data: { ...data, ...(reseed ? { seeded: false } : {}) } });
export const deleteRule = async (id: string) => (await prisma.eventRule.deleteMany({ where: { id } })).count;

export const listSources = () => prisma.eventSource.findMany({ orderBy: { createdAt: "asc" } });
export const countSources = () => prisma.eventSource.count();
export const findSource = (id: string) => prisma.eventSource.findUnique({ where: { id } });
type SourceData = { name: string; enabled: boolean; icsUrl: string | null; pageUrlTemplate: string | null; contentSelector: string | null; fetchMode: string; overviewChannelId: string | null; overviewDays: number; summaryChannelId: string | null; summaryAuto: boolean };
export const createSource = (data: SourceData) => prisma.eventSource.create({ data });
export const updateSource = (id: string, data: SourceData & { baselined?: false }) => prisma.eventSource.update({ where: { id }, data });
export const deleteSource = async (id: string) => (await prisma.eventSource.deleteMany({ where: { id } })).count;

/** Events from a month ago on, up to 80 per source (the page shows them per source). */
export const listEvents = () => prisma.gameEvent.findMany({ where: { startsAt: { gte: new Date(Date.now() - 30 * 86_400_000) } }, orderBy: { startsAt: "asc" }, take: 600 });
export const findEvent = (id: string) => prisma.gameEvent.findUnique({ where: { id } });
type EventData = { title: string; kind: string; startsAt: Date; endsAt: Date | null; allDay: boolean; description: string; summary: string; items: string[]; imageUrl: string | null; videoUrl: string | null; reminderDays: number[] };
export const createManualEvent = (sourceId: string, key: string, data: EventData) => prisma.gameEvent.create({ data: { ...data, sourceId, key, origin: "manual", locked: true } });
/** Editing locks the event: a sync never overwrites it again. */
export const updateEvent = (id: string, data: EventData) => prisma.gameEvent.update({ where: { id }, data: { ...data, locked: true } });
export const deleteEvent = async (id: string) => (await prisma.gameEvent.deleteMany({ where: { id } })).count;
export const hideEvent = (id: string) => prisma.gameEvent.update({ where: { id }, data: { locked: true, removedAt: new Date() } });
export const restoreEvent = (id: string) => prisma.gameEvent.update({ where: { id }, data: { removedAt: null } });
