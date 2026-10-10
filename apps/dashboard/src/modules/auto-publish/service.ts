import "server-only";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { addPublishChannel, findPublishChannel, listPublishChannels, removePublishChannel } from "./repository";
import type { AutoPublishResult } from "./schema";

/** The chosen channels, and the announcement channels of the server that can still be added (null = bot unreachable). */
export async function getAutoPublishPage() {
  const [rows, channels] = await Promise.all([listPublishChannels(), listChannels(["text"])]);
  const chosen = new Set(rows.map((r) => r.channelId));
  return {
    chosen: rows.map((r) => r.channelId),
    channels: channels && channels.map((c) => ({ id: c.id, name: c.name, parent: c.parent, announcement: c.announcement === true })),
    available: channels ? channels.filter((c) => c.announcement === true && !chosen.has(c.id)) : null,
  };
}

/** Adds an announcement channel. It must be an announcement channel of the server, checked through the bot. */
export async function addAutoPublish(channelId: string): Promise<AutoPublishResult> {
  try {
    if (await findPublishChannel(channelId)) return { ok: false, error: "alreadyAdded" };
    const channels = await listChannels(["text"]);
    if (!channels) return { ok: false, error: "botUnavailable" };
    if (!channels.some((c) => c.id === channelId && c.announcement === true)) return { ok: false, error: "channelNotFound" };
    await addPublishChannel(channelId);
    return { ok: true, botNotified: await reloadBotModule("autopublish") };
  } catch (error) {
    console.error("[auto-publish] adding failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeAutoPublish(channelId: string): Promise<AutoPublishResult> {
  try {
    if ((await removePublishChannel(channelId)) === 0) return { ok: false, error: "notFound" };
    return { ok: true, botNotified: await reloadBotModule("autopublish") };
  } catch (error) {
    console.error("[auto-publish] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
