import "server-only";
import { MAX_STAT_CHANNELS, STAT_KINDS, type StatChannelInput, type StatKind } from "@aboutselphy/shared/stat-channels";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { countStatChannels, createStatChannel, deleteStatChannel, findByChannel, findStatChannel, listStatChannels, updateStatChannel } from "./repository";
import type { SaveStatChannelResult, StatChannelRow } from "./schema";

export async function getStatChannelsPage() {
  const [rows, channels] = await Promise.all([listStatChannels(), listChannels(["voice"])]);
  const stats: StatChannelRow[] = rows.map((r) => ({ id: r.id, channelId: r.channelId, kind: (STAT_KINDS.find((k) => k === r.kind) ?? "members") as StatKind, template: r.template, lastName: r.lastName }));
  return { stats, channels };
}

/** Adds (no id) or changes (with id) a stat channel. A new channel must be a voice channel of the server, checked through the bot. */
export async function saveStatChannel(input: StatChannelInput): Promise<SaveStatChannelResult> {
  try {
    if (input.id) {
      const existing = await findStatChannel(input.id);
      if (!existing) return { ok: false, error: "notFound" };
      await updateStatChannel(existing.id, { kind: input.kind, template: input.template });
    } else {
      if ((await countStatChannels()) >= MAX_STAT_CHANNELS) return { ok: false, error: "tooMany" };
      if (await findByChannel(input.channelId)) return { ok: false, error: "alreadyAdded" };
      const channels = await listChannels(["voice"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
      await createStatChannel({ channelId: input.channelId, kind: input.kind, template: input.template });
    }
    return { ok: true, botNotified: await reloadBotModule("statchannels") };
  } catch (error) {
    console.error("[stat-channels] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeStatChannel(id: string): Promise<SaveStatChannelResult> {
  try {
    if ((await deleteStatChannel(id)) === 0) return { ok: false, error: "notFound" };
    return { ok: true, botNotified: true };
  } catch (error) {
    console.error("[stat-channels] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
