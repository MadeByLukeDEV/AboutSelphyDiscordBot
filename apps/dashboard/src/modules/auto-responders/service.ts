import "server-only";
import { MAX_AUTO_RESPONDERS, MATCH_TYPES, type AutoResponderInput, type MatchType } from "@aboutselphy/shared/auto-responders";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { countResponders, createResponder, deleteResponder, findResponder, listResponders, updateResponder } from "./repository";
import type { AutoResponderRow, SaveAutoResponderResult } from "./schema";

export async function getAutoRespondersPage() {
  const [rows, channels] = await Promise.all([listResponders(), listChannels(["text"])]);
  const responders: AutoResponderRow[] = rows.map((r) => ({ id: r.id, trigger: r.trigger, matchType: (MATCH_TYPES.find((m) => m === r.matchType) ?? "word") as MatchType, response: r.response, cooldownSeconds: r.cooldownSeconds, channelIds: r.channelIds, enabled: r.enabled, uses: r.uses }));
  return { responders, channels };
}

/** Adds (no id) or changes (with id) an auto-responder. Chosen channels must be text channels of the server, checked through the bot. */
export async function saveAutoResponder(input: AutoResponderInput, byName: string): Promise<SaveAutoResponderResult> {
  try {
    const existing = input.id ? await findResponder(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (!existing && (await countResponders()) >= MAX_AUTO_RESPONDERS) return { ok: false, error: "tooMany" };
    const added = input.channelIds.filter((id) => !existing?.channelIds.includes(id));
    if (added.length > 0) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (added.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    const data = { trigger: input.trigger, matchType: input.matchType, response: input.response, cooldownSeconds: input.cooldownSeconds, channelIds: input.channelIds, enabled: input.enabled };
    if (existing) await updateResponder(existing.id, data);
    else await createResponder({ ...data, createdByName: byName.slice(0, 100) });
    return { ok: true, botNotified: await reloadBotModule("autoresponders") };
  } catch (error) {
    console.error("[auto-responders] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeAutoResponder(id: string): Promise<SaveAutoResponderResult> {
  try {
    if ((await deleteResponder(id)) === 0) return { ok: false, error: "notFound" };
    return { ok: true, botNotified: await reloadBotModule("autoresponders") };
  } catch (error) {
    console.error("[auto-responders] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
