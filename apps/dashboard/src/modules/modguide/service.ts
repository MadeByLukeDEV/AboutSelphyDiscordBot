import "server-only";
import type { ModGuide } from "@aboutselphy/db";
import type { ModGuideInput } from "@aboutselphy/shared/modguide";
import { errorInfo } from "@/lib/log";
import { getModGuidePreview, listChannels, postModGuideViaBot } from "@/modules/bot-api";
import { forgetMessages, readGuide, updateGuide } from "./repository";
import type { ModGuidePageData, PostModGuideResult, SaveModGuideResult } from "./schema";

const toSettings = (g: ModGuide): ModGuideInput => ({ channelId: g.channelId ?? "", title: g.title, description: g.description, imageUrl: g.imageUrl, color: g.color, notes: g.notes });

/** Settings, when it was last posted, the commands the bot lists, and the channels to pick from (null = bot unreachable). */
export async function getModGuidePage(): Promise<ModGuidePageData & { channels: Awaited<ReturnType<typeof listChannels>> }> {
  const [guide, preview, channels] = await Promise.all([readGuide(), getModGuidePreview(), listChannels(["text"])]);
  return { settings: toSettings(guide), postedAt: guide.postedAt?.toISOString() ?? null, preview, channels };
}

/** Saves the text and the channel. A new channel must be a text channel of the server (checked through the bot; refused if it can't answer). */
export async function saveModGuide(input: ModGuideInput): Promise<SaveModGuideResult> {
  try {
    const current = await readGuide();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    // A different channel means the old messages are somewhere else: post fresh ones there (the old ones stay as they are).
    const moved = (current.channelId ?? "") !== input.channelId;
    const saved = await updateGuide({ ...input, channelId: input.channelId || null });
    if (moved) await forgetMessages();
    return { ok: true, settings: toSettings(saved) };
  } catch (error) {
    console.error("[modguide] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Saves nothing: asks the bot to post the guide from what is saved. */
export async function postModGuide(): Promise<PostModGuideResult> {
  try {
    const guide = await readGuide();
    if (!guide.channelId) return { ok: false, error: "needsChannel" };
    const result = await postModGuideViaBot();
    if (!result) return { ok: false, error: "botUnavailable" };
    if (result.status === "done") return { ok: true, messages: result.messages };
    if (result.status === "channel") return { ok: false, error: "channelNotUsable" };
    return { ok: false, error: result.status === "noChannel" ? "needsChannel" : "failed" };
  } catch (error) {
    console.error("[modguide] posting failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
