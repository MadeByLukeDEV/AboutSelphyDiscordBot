import "server-only";
import { MAX_STICKY, type StickyInput } from "@aboutselphy/shared/sticky";
import { errorInfo } from "@/lib/log";
import { clearStickyViaBot, listChannels, reloadBotModule } from "@/modules/bot-api";
import { countStickies, createSticky, deleteSticky, findByChannel, findSticky, listStickies, updateSticky } from "./repository";
import type { StickyResult, StickyRow } from "./schema";

export async function getStickyPage() {
  const [rows, channels] = await Promise.all([listStickies(), listChannels(["text"])]);
  const stickies: StickyRow[] = rows.map((r) => ({ id: r.id, channelId: r.channelId, content: r.content, enabled: r.enabled }));
  return { stickies, channels };
}

/** Adds (no id) or changes (with id) a sticky message and asks the bot to post it. A new channel must be a text channel of the server, checked through the bot. */
export async function saveSticky(input: StickyInput): Promise<StickyResult> {
  try {
    if (input.id) {
      const existing = await findSticky(input.id);
      if (!existing) return { ok: false, error: "notFound" };
      await updateSticky(existing.id, { content: input.content, enabled: input.enabled });
    } else {
      if ((await countStickies()) >= MAX_STICKY) return { ok: false, error: "tooMany" };
      if (await findByChannel(input.channelId)) return { ok: false, error: "alreadyAdded" };
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
      await createSticky({ channelId: input.channelId, content: input.content, enabled: input.enabled });
    }
    return { ok: true, botNotified: await reloadBotModule("sticky") };
  } catch (error) {
    console.error("[sticky] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Takes the current copy down through the bot, then removes the row. If the bot can't be reached the row stays, so nothing is left behind in the channel. */
export async function removeSticky(id: string): Promise<StickyResult> {
  try {
    const existing = await findSticky(id);
    if (!existing) return { ok: false, error: "notFound" };
    const cleared = await clearStickyViaBot(existing.channelId);
    if (cleared === null) return { ok: false, error: "botUnavailable" };
    await deleteSticky(id);
    return { ok: true, botNotified: true };
  } catch (error) {
    console.error("[sticky] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
