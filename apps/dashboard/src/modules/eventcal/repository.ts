import "server-only";
// Private to the eventcal module: only service.ts imports this.
import { itemKey, type ReminderDefaults } from "@aboutselphy/shared/eventcal";
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

type RuleData = { name: string; words: string[]; categories: string[]; kinds: string[]; channelId: string; pingRoleId: string | null; leadDays: number[]; useCard: boolean; postSeries: boolean; useAi: boolean; enabled: boolean; sourceId: string };
export const createRule = (data: RuleData) => prisma.eventRule.create({ data });
/** A changed match or channel starts over for the rule: its next check only remembers what matches. */
export const updateRule = (id: string, data: RuleData, reseed: boolean) => prisma.eventRule.update({ where: { id }, data: { ...data, ...(reseed ? { seeded: false } : {}) } });
export const deleteRule = async (id: string) => (await prisma.eventRule.deleteMany({ where: { id } })).count;

export const listSources = () => prisma.eventSource.findMany({ orderBy: { createdAt: "asc" } });
export const countSources = () => prisma.eventSource.count();
export const findSource = (id: string) => prisma.eventSource.findUnique({ where: { id } });
type SourceData = { name: string; enabled: boolean; icsUrl: string | null; pageUrlTemplate: string | null; contentSelector: string | null; fetchMode: string; overviewChannelId: string | null; overviewDays: number; summaryChannelId: string | null; summaryAuto: boolean; reminderDefaults: ReminderDefaults; accentColor: string; summaryImage: boolean; publicWidget: boolean; patchListUrl: string | null; patchChannelId: string | null; patchPingRoleId: string | null };
export const createSource = (data: SourceData) => prisma.eventSource.create({ data });
export const updateSource = (id: string, data: SourceData & { baselined?: false; patchBaselined?: false }) => prisma.eventSource.update({ where: { id }, data });
export const deleteSource = async (id: string) => (await prisma.eventSource.deleteMany({ where: { id } })).count;

/** Events from a month ago on, up to 80 per source (the page shows them per source). */
// Events the sync removed by itself (an occurrence that became part of a series, an event gone from the page) are not listed; only ones an admin hid are.
export const listEvents = () => prisma.gameEvent.findMany({ where: { startsAt: { gte: new Date(Date.now() - 30 * 86_400_000) }, OR: [{ removedAt: null }, { locked: true }] }, orderBy: { startsAt: "asc" }, take: 600 });
export const findEvent = (id: string) => prisma.gameEvent.findUnique({ where: { id } });
type EventData = { title: string; kind: string; startsAt: Date; endsAt: Date | null; allDay: boolean; description: string; summary: string; items: string[]; imageUrl: string | null; videoUrl: string | null; reminderDays: number[] };
export const createManualEvent = (sourceId: string, key: string, data: EventData) => prisma.gameEvent.create({ data: { ...data, sourceId, key, origin: "manual", locked: true } });
/** Editing locks the event: a sync never overwrites it again. */
export const updateEvent = (id: string, data: EventData) => prisma.gameEvent.update({ where: { id }, data: { ...data, locked: true } });
export const deleteEvent = async (id: string) => (await prisma.gameEvent.deleteMany({ where: { id } })).count;
export const hideEvent = (id: string) => prisma.gameEvent.update({ where: { id }, data: { locked: true, removedAt: new Date() } });
export const restoreEvent = (id: string) => prisma.gameEvent.update({ where: { id }, data: { removedAt: null } });

// ---- items and pictures

export type PictureData = { data: Uint8Array<ArrayBuffer>; contentType: string; width: number; height: number; uploadedByName: string };

export const listItems = () => prisma.eventItem.findMany({ select: { id: true, sourceId: true, name: true, imageType: true }, orderBy: { name: "asc" }, take: 3000 });
export const findItem = (id: string) => prisma.eventItem.findUnique({ where: { id }, select: { id: true, sourceId: true } });
export const readItemImage = (id: string) => prisma.eventItem.findUnique({ where: { id }, select: { imageData: true, imageType: true } });
export const setItemImage = (id: string, p: PictureData) => prisma.eventItem.update({ where: { id }, data: { imageData: p.data, imageType: p.contentType, imageWidth: p.width, imageHeight: p.height, imageUpdatedAt: new Date(), uploadedByName: p.uploadedByName } });
export const clearItemImage = (id: string) => prisma.eventItem.update({ where: { id }, data: { imageData: null, imageType: null, imageWidth: null, imageHeight: null, imageUpdatedAt: null, uploadedByName: null } });
export const deleteItem = async (id: string) => (await prisma.eventItem.deleteMany({ where: { id } })).count;

/** An event's items get a library row each (without a picture), so the admin sees what still needs one. */
export async function ensureItems(sourceId: string, names: string[]): Promise<void> {
  const unique = new Map(names.map((n) => [itemKey(n), n.slice(0, 80)] as const).filter(([k]) => k !== ""));
  if (unique.size === 0) return;
  await prisma.eventItem.createMany({ data: [...unique].map(([key, name]) => ({ sourceId, key, name })), skipDuplicates: true });
}

export const listBackgrounds = () => prisma.eventSourceImage.findMany({ select: { sourceId: true } });
export const readBackground = (sourceId: string) => prisma.eventSourceImage.findUnique({ where: { sourceId } });
export const saveBackground = (sourceId: string, p: PictureData) => prisma.eventSourceImage.upsert({ where: { sourceId }, update: { ...p, uploadedAt: new Date() }, create: { sourceId, ...p } });
export const deleteBackground = async (sourceId: string) => void (await prisma.eventSourceImage.deleteMany({ where: { sourceId } }));


// ---- public feed

/** The source only when its owner switched the public widget on and the source itself is enabled. */
export const findPublicSource = (id: string) => prisma.eventSource.findFirst({ where: { id, publicWidget: true, enabled: true }, select: { id: true, name: true, accentColor: true } });
/** Events that run now or start within 90 days, not hidden, at most 60. */
export const listPublicEvents = (sourceId: string, now: Date) =>
  prisma.gameEvent.findMany({
    where: { sourceId, removedAt: null, OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }], startsAt: { lte: new Date(now.getTime() + 90 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
    take: 60,
    select: { title: true, kind: true, startsAt: true, endsAt: true, allDay: true, summary: true, blurb: true, items: true, recurrence: true },
  });
