// Private to the eventcal module: only service.ts imports this.
import { prisma, type EventCalendarConfig, type EventRule } from "@aboutselphy/db";

export const readConfig = (): Promise<EventCalendarConfig> => prisma.eventCalendarConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

export const listRules = (): Promise<EventRule[]> => prisma.eventRule.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });

export const markSeeded = (ruleId: string) => prisma.eventRule.update({ where: { id: ruleId }, data: { seeded: true } });

export function recordCheck(status: string, baselined?: boolean) {
  return prisma.eventCalendarConfig.update({ where: { id: 1 }, data: { lastCheckedAt: new Date(), lastStatus: status.slice(0, 40), ...(baselined ? { baselined: true } : {}) } });
}

export const findPost = (ruleId: string, eventKey: string) => prisma.eventPost.findUnique({ where: { ruleId_eventKey: { ruleId, eventKey } } });

/** Claims an occurrence for a rule. False when it was already there, so only one caller posts it. */
export async function claimPost(data: { ruleId: string; eventKey: string; startsAt: Date; channelId: string; hash: string; messageId: string | null }): Promise<boolean> {
  return (await prisma.eventPost.createMany({ data: [{ ...data, eventKey: data.eventKey.slice(0, 160) }], skipDuplicates: true })).count === 1;
}

export const setPostMessage = (ruleId: string, eventKey: string, messageId: string) => prisma.eventPost.update({ where: { ruleId_eventKey: { ruleId, eventKey: eventKey.slice(0, 160) } }, data: { messageId } });
export const setPostHash = (ruleId: string, eventKey: string, hash: string) => prisma.eventPost.update({ where: { ruleId_eventKey: { ruleId, eventKey: eventKey.slice(0, 160) } }, data: { hash } });
export const unclaimPost = (ruleId: string, eventKey: string) => prisma.eventPost.deleteMany({ where: { ruleId, eventKey: eventKey.slice(0, 160) } });
export const prunePosts = (before: Date) => prisma.eventPost.deleteMany({ where: { startsAt: { lt: before } } });

export const setOverview = (channelId: string, messageId: string, hash: string) => prisma.eventCalendarConfig.update({ where: { id: 1 }, data: { overviewChannelId: channelId, overviewMessageId: messageId, overviewHash: hash } });
export const setOverviewHash = (hash: string) => prisma.eventCalendarConfig.update({ where: { id: 1 }, data: { overviewHash: hash } });

export const listArticles = () => prisma.eventArticle.findMany({ orderBy: { createdAt: "desc" }, take: 4 });

export async function readSummary(hash: string): Promise<string | null> {
  return (await prisma.eventSummary.findUnique({ where: { hash } }))?.json ?? null;
}
export const saveSummary = (hash: string, json: string) => prisma.eventSummary.upsert({ where: { hash }, update: { json }, create: { hash, json } });
export const pruneSummaries = (before: Date) => prisma.eventSummary.deleteMany({ where: { createdAt: { lt: before } } });
