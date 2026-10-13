// Private to the eventcal module: only service.ts imports this.
import { prisma, type EventRule } from "@aboutselphy/db";

/** The state of one source: the main calendar (id null, config row) or an article-only game (EventSource row). The columns share their names. */
export type SourceState = {
  id: string | null;
  name: string;
  enabled: boolean;
  /** Null = no calendar feed, the events come from pasted articles only. */
  icsUrl: string | null;
  overviewChannelId: string | null;
  overviewMessageId: string | null;
  overviewHash: string;
  overviewDays: number;
  summaryChannelId: string | null;
  summaryMonth: string | null;
  summaryMessageIds: string[];
  summaryHash: string;
  baselined: boolean;
};

const MAIN_NAME = "Calendar";

async function readMain(): Promise<SourceState> {
  const c = await prisma.eventCalendarConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return { ...c, id: null, name: MAIN_NAME };
}

/** The main calendar first, then every enabled game source. */
export async function listSources(): Promise<SourceState[]> {
  const extra = await prisma.eventSource.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } });
  return [await readMain(), ...extra.map((s) => ({ ...s, icsUrl: null }))];
}

/** One source by id ("" or null = the main calendar). Null when it no longer exists. */
export async function readSource(id: string | null): Promise<SourceState | null> {
  if (!id) return readMain();
  const s = await prisma.eventSource.findUnique({ where: { id } });
  return s ? { ...s, icsUrl: null } : null;
}

type StateChange = Partial<{
  overviewChannelId: string;
  overviewMessageId: string;
  overviewHash: string;
  summaryMonth: string;
  summaryMessageIds: string[];
  summaryHash: string;
  baselined: boolean;
  lastCheckedAt: Date;
  lastStatus: string;
}>;

export async function saveState(id: string | null, data: StateChange): Promise<void> {
  if (!id) await prisma.eventCalendarConfig.update({ where: { id: 1 }, data });
  else await prisma.eventSource.updateMany({ where: { id }, data });
}

export const listRules = (sourceId: string | null): Promise<EventRule[]> => prisma.eventRule.findMany({ where: { enabled: true, sourceId }, orderBy: { createdAt: "asc" } });

export const markSeeded = (ruleId: string) => prisma.eventRule.update({ where: { id: ruleId }, data: { seeded: true } });

export const recordCheck = (id: string | null, status: string, baselined?: boolean) => saveState(id, { lastCheckedAt: new Date(), lastStatus: status.slice(0, 40), ...(baselined ? { baselined: true } : {}) });

export const findPost = (ruleId: string, eventKey: string) => prisma.eventPost.findUnique({ where: { ruleId_eventKey: { ruleId, eventKey } } });

/** Claims an occurrence for a rule. False when it was already there, so only one caller posts it. */
export async function claimPost(data: { ruleId: string; eventKey: string; startsAt: Date; channelId: string; hash: string; messageId: string | null; title?: string }): Promise<boolean> {
  return (await prisma.eventPost.createMany({ data: [{ ...data, eventKey: data.eventKey.slice(0, 160), title: (data.title ?? "").slice(0, 120) }], skipDuplicates: true })).count === 1;
}

export const setPostMessage = (ruleId: string, eventKey: string, messageId: string) => prisma.eventPost.update({ where: { ruleId_eventKey: { ruleId, eventKey: eventKey.slice(0, 160) } }, data: { messageId } });
export const setPostHash = (ruleId: string, eventKey: string, hash: string) => prisma.eventPost.update({ where: { ruleId_eventKey: { ruleId, eventKey: eventKey.slice(0, 160) } }, data: { hash } });
export const unclaimPost = (ruleId: string, eventKey: string) => prisma.eventPost.deleteMany({ where: { ruleId, eventKey: eventKey.slice(0, 160) } });
export const prunePosts = (before: Date) => prisma.eventPost.deleteMany({ where: { startsAt: { lt: before } } });

export const setOverview = (id: string | null, channelId: string, messageId: string, hash: string) => saveState(id, { overviewChannelId: channelId, overviewMessageId: messageId, overviewHash: hash });
export const setOverviewHash = (id: string | null, hash: string) => saveState(id, { overviewHash: hash });

export const listArticles = (sourceId: string | null) => prisma.eventArticle.findMany({ where: { sourceId }, orderBy: { createdAt: "desc" }, take: 4 });

export async function readSummary(hash: string): Promise<string | null> {
  return (await prisma.eventSummary.findUnique({ where: { hash } }))?.json ?? null;
}
export const saveSummary = (hash: string, json: string) => prisma.eventSummary.upsert({ where: { hash }, update: { json }, create: { hash, json } });
export const pruneSummaries = (before: Date) => prisma.eventSummary.deleteMany({ where: { createdAt: { lt: before } } });

export const findPostById = (id: string) => prisma.eventPost.findUnique({ where: { id }, include: { rule: true } });
export const updatePostMessage = (id: string, messageId: string, hash: string) => prisma.eventPost.update({ where: { id }, data: { messageId, hash } });

export const setMonthly = (id: string | null, data: { summaryMonth: string; summaryMessageIds: string[]; summaryHash: string }) => saveState(id, data);
