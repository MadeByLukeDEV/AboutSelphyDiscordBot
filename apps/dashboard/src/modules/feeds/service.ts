import "server-only";
import { decryptToken, encryptToken } from "@aboutselphy/shared/token-cipher";
import { MAX_FEEDS, type FeedInput } from "@aboutselphy/shared/feeds";
import { env } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { checkFeedViaBot, listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { countFeeds, createFeed, deleteFeed, findFeed, listFeeds, updateFeed } from "./repository";
import type { CheckFeedResult, FeedRow, SaveFeedResult } from "./schema";

const URL_PURPOSE = "feed-url";
const key = () => env().TOKEN_ENCRYPTION_KEY;

/** Only the host of a stored address is ever shown: bridges carry an access key in the rest. */
function hostOf(urlEnc: string): string {
  try {
    const k = key();
    return k ? new URL(decryptToken(urlEnc, URL_PURPOSE, k)).hostname : "unreadable";
  } catch {
    return "unreadable";
  }
}

export async function getFeedsPage() {
  const [rows, channels, roles] = await Promise.all([listFeeds(), listChannels(["text"]), listRoles()]);
  const feeds: FeedRow[] = rows.map((f) => ({
    id: f.id,
    name: f.name,
    host: hostOf(f.urlEnc),
    channelId: f.channelId,
    pingRoleId: f.pingRoleId,
    messageTemplate: f.messageTemplate,
    intervalMinutes: f.intervalMinutes,
    includeWords: f.includeWords,
    excludeWords: f.excludeWords,
    useEmbed: f.useEmbed,
    filterDescription: f.filterDescription,
    digest: f.digest,
    enabled: f.enabled,
    baselined: f.baselined,
    lastCheckedAt: f.lastCheckedAt?.toISOString() ?? null,
    lastStatus: f.lastStatus,
  }));
  return { feeds, channels, roles, ready: Boolean(key()) };
}

/** Adds (no id) or changes (with id) a feed. The address is encrypted; channel and role must exist in the server (checked through the bot). */
export async function saveFeed(input: FeedInput, byName: string): Promise<SaveFeedResult> {
  try {
    const k = key();
    if (!k) return { ok: false, error: "notReady" };
    const existing = input.id ? await findFeed(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (!existing && (await countFeeds()) >= MAX_FEEDS) return { ok: false, error: "tooMany" };

    const roleId = input.pingRoleId || null;
    if (!existing || existing.channelId !== input.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    if (roleId && roleId !== existing?.pingRoleId) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      if (!roles.some((r) => r.id === roleId)) return { ok: false, error: "roleNotFound" };
    }

    const data = { name: input.name, channelId: input.channelId, pingRoleId: roleId, messageTemplate: input.messageTemplate, intervalMinutes: input.intervalMinutes, includeWords: input.includeWords, excludeWords: input.excludeWords, useEmbed: input.useEmbed, filterDescription: input.filterDescription, digest: input.digest, enabled: input.enabled };
    if (existing) await updateFeed(existing.id, { ...data, ...(input.url ? { urlEnc: encryptToken(input.url, URL_PURPOSE, k) } : {}) });
    else await createFeed({ ...data, urlEnc: encryptToken(input.url, URL_PURPOSE, k), createdByName: byName.slice(0, 100) });
    return { ok: true, botNotified: await reloadBotModule("feeds") };
  } catch (error) {
    console.error("[feeds] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeFeed(id: string): Promise<SaveFeedResult> {
  try {
    return (await deleteFeed(id)) === 0 ? { ok: false, error: "notFound" } : { ok: true, botNotified: true };
  } catch (error) {
    console.error("[feeds] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Asks the bot to check the feed right now (the first check after a new address only remembers what is there). */
export async function checkFeedNow(id: string): Promise<CheckFeedResult> {
  if (!(await findFeed(id))) return { ok: false, error: "notFound" };
  const result = await checkFeedViaBot(id);
  return result ? { ok: true, ...result } : { ok: false, error: "botUnavailable" };
}
