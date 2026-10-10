import "server-only";
import type { GiveawayAction, GiveawayInput } from "@aboutselphy/shared/giveaways";
import { errorInfo } from "@/lib/log";
import { giveawayAction, listChannels, listRoles } from "@/modules/bot-api";
import type { StaffSession } from "@/modules/auth";
import { createGiveaway, deleteInactive, findGiveaway, listGiveaways, updateDraft, type GiveawayWithCount } from "./repository";
import type { GiveawayActionResult, GiveawayError, GiveawayView, SaveGiveawayResult } from "./schema";

const toView = (g: GiveawayWithCount): GiveawayView => ({
  id: g.id,
  status: g.status,
  channelId: g.channelId,
  prize: g.prize,
  description: g.description,
  imageUrl: g.imageUrl,
  winnerCount: g.winnerCount,
  endsAt: g.endsAt.toISOString(),
  requiredRoleId: g.requiredRoleId ?? "",
  pingRoleId: g.pingRoleId ?? "",
  hostName: g.hostName,
  winners: g.winners,
  entryCount: g._count.entries,
});

/** The giveaways plus the channels and roles to pick from (null = the bot can't be reached). */
export async function getGiveawaysPage() {
  const [rows, channels, roles] = await Promise.all([listGiveaways(), listChannels(["text"]), listRoles()]);
  return { giveaways: rows.map(toView), channels, roles };
}

const fail = (error: GiveawayError) => ({ ok: false as const, error });
const fromStatus = (status: string | null): GiveawayError | null =>
  status === "done" ? null : status === null ? "botUnavailable" : status === "channel" ? "channelNotFound" : status === "role" ? "roleNotFound" : status === "not-found" ? "notFound" : status === "wrong-state" ? "wrongState" : "failed";

/**
 * Creates (no id) or changes (with id, drafts only) a giveaway, and starts it if asked. The channel and
 * roles must exist in the server (checked through the bot, refused if it can't answer). If posting
 * fails the giveaway is still saved as a draft and the reason is returned.
 */
export async function saveGiveaway(input: GiveawayInput, by: StaffSession["user"]): Promise<SaveGiveawayResult> {
  try {
    const existing = input.id ? await findGiveaway(input.id) : null;
    if (input.id && !existing) return fail("notFound");
    if (existing && existing.status !== "draft") return fail("wrongState");

    const [channels, roles] = await Promise.all([listChannels(["text"]), listRoles()]);
    if (!channels || !roles) return fail("botUnavailable");
    if (!channels.some((c) => c.id === input.channelId)) return fail("channelNotFound");
    for (const id of [input.requiredRoleId, input.pingRoleId]) if (id && !roles.some((r) => r.id === id)) return fail("roleNotFound");

    const data = {
      channelId: input.channelId,
      prize: input.prize,
      description: input.description,
      imageUrl: input.imageUrl,
      winnerCount: input.winnerCount,
      endsAt: new Date(input.endsAt),
      requiredRoleId: input.requiredRoleId || null,
      pingRoleId: input.pingRoleId || null,
    };
    let id: string;
    if (existing) {
      if (!(await updateDraft(existing.id, data))) return fail("wrongState");
      id = existing.id;
    } else {
      id = (await createGiveaway(data, { userId: by.id, name: by.name })).id;
    }

    let startError: GiveawayError | null = null;
    if (input.start) startError = fromStatus(await giveawayAction(id, "start"));
    const saved = (await findGiveaway(id))!;
    return { ok: true, giveaway: toView(saved), started: input.start && startError === null, startError };
  } catch (error) {
    console.error("[giveaways] saving failed", errorInfo(error));
    return fail("failed");
  }
}

/** Ends now, re-rolls the winners, or cancels, through the bot (it owns everything on Discord). */
export async function runAction(id: string, action: Exclude<GiveawayAction, "start">): Promise<GiveawayActionResult> {
  const error = fromStatus(await giveawayAction(id, action));
  return error ? fail(error) : { ok: true };
}

/** Removes a draft, ended or cancelled giveaway from the list. */
export async function removeGiveaway(id: string): Promise<GiveawayActionResult> {
  try {
    if (!(await deleteInactive(id))) return fail((await findGiveaway(id)) ? "wrongState" : "notFound");
    return { ok: true };
  } catch (error) {
    console.error("[giveaways] removing failed", errorInfo(error));
    return fail("failed");
  }
}
