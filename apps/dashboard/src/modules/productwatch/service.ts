import "server-only";
import { MAX_PRODUCT_WATCHES, parseProductUrl, type ProductWatchInput } from "@aboutselphy/shared/productwatch";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { countWatches, createWatch, deleteWatch, findWatch, listWatches, updateWatch } from "./repository";
import type { ProductWatchResult, ProductWatchRow } from "./schema";

/** The shop's prices are cents in its own currency. */
const money = (cents: number) => (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** What the last look saw, read defensively (the stored snapshot is JSON the bot wrote). */
function seen(snapshot: unknown): { title: string | null; prices: string[]; available: boolean | null } {
  const s = snapshot as { title?: unknown; variants?: unknown } | null;
  if (!s || typeof s.title !== "string" || !Array.isArray(s.variants)) return { title: null, prices: [], available: null };
  const variants = s.variants.filter((v): v is { price: number; available: boolean } => typeof v?.price === "number" && typeof v?.available === "boolean");
  return { title: s.title, prices: [...new Set(variants.map((v) => money(v.price)))].slice(0, 5), available: variants.length ? variants.some((v) => v.available) : null };
}

export async function getProductWatchPage() {
  const rows = await listWatches();
  const watches: ProductWatchRow[] = rows.map((w) => {
    const s = seen(w.snapshot);
    return {
      id: w.id,
      name: w.name,
      url: w.url,
      channelId: w.channelId,
      pingRoleId: w.pingRoleId,
      enabled: w.enabled,
      baselined: w.baselined,
      seenTitle: s.title,
      seenPrices: s.prices,
      seenAvailable: s.available,
      lastCheckedAt: w.lastCheckedAt?.toISOString() ?? null,
      lastStatus: w.lastStatus,
      lastChangedAt: w.lastChangedAt?.toISOString() ?? null,
    };
  });
  return { watches };
}

/** Adds (no id) or changes (with id) a watched product. The channel and role must exist in the server (checked through the bot). */
export async function saveWatch(input: ProductWatchInput, byName: string): Promise<ProductWatchResult> {
  try {
    const parts = parseProductUrl(input.url);
    if (!parts) return { ok: false, error: "invalid" };
    const existing = input.id ? await findWatch(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (!existing && (await countWatches()) >= MAX_PRODUCT_WATCHES) return { ok: false, error: "tooMany" };

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

    const data = { name: input.name, url: parts.pageUrl, channelId: input.channelId, pingRoleId: roleId, enabled: input.enabled };
    if (existing) await updateWatch(existing.id, data, existing.url !== parts.pageUrl);
    else await createWatch({ ...data, createdByName: byName.slice(0, 100) });
    return { ok: true, botNotified: await reloadBotModule("productwatch") };
  } catch (error) {
    console.error("[productwatch] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeWatch(id: string): Promise<ProductWatchResult> {
  try {
    return (await deleteWatch(id)) === 0 ? { ok: false, error: "notFound" } : { ok: true, botNotified: true };
  } catch (error) {
    console.error("[productwatch] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Asks the bot to look at every watched product now. */
export async function checkWatchesNow(): Promise<ProductWatchResult> {
  return { ok: true, botNotified: await reloadBotModule("productwatch") };
}
