// Private to the eventcal module: only service.ts and sync.ts import this.
import { prisma, type EventRule, type GameEvent } from "@aboutselphy/db";

/** One source (a game): its settings and the state of its overview and monthly summary messages. */
export type SourceState = {
  id: string;
  name: string;
  enabled: boolean;
  icsUrl: string | null;
  pageUrlTemplate: string | null;
  contentSelector: string | null;
  fetchMode: string;
  lastFetchedAt: Date | null;
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

const toState = (s: Awaited<ReturnType<typeof prisma.eventSource.findFirstOrThrow>>): SourceState => s;

/** Every enabled source. */
export async function listSources(): Promise<SourceState[]> {
  return (await prisma.eventSource.findMany({ where: { enabled: true }, orderBy: { createdAt: "asc" } })).map(toState);
}

/** One source by id (even a disabled one). Null when it no longer exists. */
export async function readSource(id: string): Promise<SourceState | null> {
  const s = await prisma.eventSource.findUnique({ where: { id } });
  return s ? toState(s) : null;
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
  lastFetchedAt: Date;
  lastFetchStatus: string;
}>;

export const saveState = (id: string, data: StateChange) => prisma.eventSource.updateMany({ where: { id }, data });

export const listRules = (sourceId: string): Promise<EventRule[]> => prisma.eventRule.findMany({ where: { enabled: true, sourceId }, orderBy: { createdAt: "asc" } });

export const markSeeded = (ruleId: string) => prisma.eventRule.update({ where: { id: ruleId }, data: { seeded: true } });

export const recordCheck = (id: string, status: string, baselined?: boolean) => saveState(id, { lastCheckedAt: new Date(), lastStatus: status.slice(0, 40), ...(baselined ? { baselined: true } : {}) });

export const findPost = (ruleId: string, eventKey: string) => prisma.eventPost.findUnique({ where: { ruleId_eventKey: { ruleId, eventKey } } });

/** Claims an occurrence for a rule. False when it was already there, so only one caller posts it. */
export async function claimPost(data: { ruleId: string; eventKey: string; startsAt: Date; channelId: string; hash: string; messageId: string | null; title?: string }): Promise<boolean> {
  return (await prisma.eventPost.createMany({ data: [{ ...data, eventKey: data.eventKey.slice(0, 160), title: (data.title ?? "").slice(0, 120) }], skipDuplicates: true })).count === 1;
}

export const setPostMessage = (ruleId: string, eventKey: string, messageId: string) => prisma.eventPost.update({ where: { ruleId_eventKey: { ruleId, eventKey: eventKey.slice(0, 160) } }, data: { messageId } });
export const setPostHash = (ruleId: string, eventKey: string, hash: string) => prisma.eventPost.update({ where: { ruleId_eventKey: { ruleId, eventKey: eventKey.slice(0, 160) } }, data: { hash } });
export const unclaimPost = (ruleId: string, eventKey: string) => prisma.eventPost.deleteMany({ where: { ruleId, eventKey: eventKey.slice(0, 160) } });
export const prunePosts = (before: Date) => prisma.eventPost.deleteMany({ where: { startsAt: { lt: before } } });

export const setOverview = (id: string, channelId: string, messageId: string, hash: string) => saveState(id, { overviewChannelId: channelId, overviewMessageId: messageId, overviewHash: hash });
export const setOverviewHash = (id: string, hash: string) => saveState(id, { overviewHash: hash });

export const listArticles = (sourceId: string) => prisma.eventArticle.findMany({ where: { sourceId }, orderBy: { createdAt: "desc" }, take: 4 });

export async function readSummary(hash: string): Promise<string | null> {
  return (await prisma.eventSummary.findUnique({ where: { hash } }))?.json ?? null;
}
export const saveSummary = (hash: string, json: string) => prisma.eventSummary.upsert({ where: { hash }, update: { json }, create: { hash, json } });
export const pruneSummaries = (before: Date) => prisma.eventSummary.deleteMany({ where: { createdAt: { lt: before } } });

export const findPostById = (id: string) => prisma.eventPost.findUnique({ where: { id }, include: { rule: true } });
export const updatePostMessage = (id: string, messageId: string, hash: string) => prisma.eventPost.update({ where: { id }, data: { messageId, hash } });

export const setMonthly = (id: string, data: { summaryMonth: string; summaryMessageIds: string[]; summaryHash: string }) => saveState(id, data);

// ---- stored events and the extraction cache

/** The source's events that are not removed and have not ended more than `from` ago, soonest first. */
export const listStoredEvents = (sourceId: string, from: Date): Promise<GameEvent[]> =>
  prisma.gameEvent.findMany({ where: { sourceId, removedAt: null, OR: [{ endsAt: { gte: from } }, { endsAt: null, startsAt: { gte: from } }] }, orderBy: { startsAt: "asc" }, take: 2000 });

export const listEventRows = (sourceId: string, from: Date, to: Date) =>
  prisma.gameEvent.findMany({ where: { sourceId, startsAt: { gte: from, lte: to } }, select: { key: true, locked: true, origin: true, removedAt: true }, take: 5000 });

type EventData = Omit<GameEvent, "id" | "sourceId" | "createdAt" | "lastSeenAt" | "removedAt" | "locked" | "origin">;

/** Inserts an event, or refreshes the one with that key. A locked event (an admin edited it) only gets its "still seen" mark. */
export async function upsertEvent(sourceId: string, origin: "calendar" | "article", data: EventData): Promise<void> {
  const now = new Date();
  const existing = await prisma.gameEvent.findUnique({ where: { sourceId_key: { sourceId, key: data.key } }, select: { locked: true, origin: true } });
  if (!existing) {
    await prisma.gameEvent.create({ data: { ...data, sourceId, origin, lastSeenAt: now } });
  } else if (existing.locked || existing.origin === "manual") {
    await prisma.gameEvent.update({ where: { sourceId_key: { sourceId, key: data.key } }, data: { lastSeenAt: now } }); // the admin decides, not the sync
  } else {
    await prisma.gameEvent.update({ where: { sourceId_key: { sourceId, key: data.key } }, data: { ...data, lastSeenAt: now, removedAt: null } });
  }
}

/** Events from the calendar or an article that a full sync no longer sees (inside the window) are marked removed; edited and manual ones stay. */
export const markVanished = (sourceId: string, seenKeys: string[], from: Date, to: Date) =>
  prisma.gameEvent.updateMany({ where: { sourceId, origin: { in: ["calendar", "article"] }, locked: false, removedAt: null, key: { notIn: seenKeys }, startsAt: { gte: from, lte: to } }, data: { removedAt: new Date() } });

export const readFetch = (sourceId: string, url: string) => prisma.eventFetch.findUnique({ where: { sourceId_url: { sourceId, url } } });
export const saveFetch = (sourceId: string, url: string, data: { contentHash: string; extractedJson: string; status: string }) =>
  prisma.eventFetch.upsert({ where: { sourceId_url: { sourceId, url } }, update: { ...data, fetchedAt: new Date() }, create: { sourceId, url, ...data } });
