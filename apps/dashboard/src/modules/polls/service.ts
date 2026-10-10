import "server-only";
import type { PollInput } from "@aboutselphy/shared/polls";
import { errorInfo } from "@/lib/log";
import { listChannels, pollAction } from "@/modules/bot-api";
import type { StaffSession } from "@/modules/auth";
import { createPoll, deleteInactive, findPoll, listPolls, type PollWithVotes } from "./repository";
import type { PollActionResult, PollError, PollView, SavePollResult } from "./schema";

const toView = (p: PollWithVotes): PollView => ({
  id: p.id,
  status: p.status,
  channelId: p.channelId,
  question: p.question,
  options: p.options,
  multiple: p.multiple,
  endsAt: p.endsAt?.toISOString() ?? null,
  createdByName: p.createdByName,
  counts: p.counts,
  voters: p.voters,
});

/** The polls plus the channels to pick from (null = the bot can't be reached). */
export async function getPollsPage() {
  const [rows, channels] = await Promise.all([listPolls(), listChannels(["text"])]);
  return { polls: rows.map(toView), channels };
}

const fail = (error: PollError) => ({ ok: false as const, error });
const fromStatus = (status: string | null): PollError | null =>
  status === "done" ? null : status === null ? "botUnavailable" : status === "channel" ? "channelNotFound" : status === "not-found" ? "notFound" : status === "wrong-state" ? "wrongState" : "failed";

/** Saves a poll as a draft and posts it right away if asked. The channel must exist in the server (checked through the bot). */
export async function savePoll(input: PollInput & { start: boolean }, by: StaffSession["user"]): Promise<SavePollResult> {
  try {
    const channels = await listChannels(["text"]);
    if (!channels) return fail("botUnavailable");
    if (!channels.some((c) => c.id === input.channelId)) return fail("channelNotFound");
    const poll = await createPoll(
      { channelId: input.channelId, question: input.question, options: input.options, multiple: input.multiple, endsAt: input.endsAt ? new Date(input.endsAt) : null },
      { userId: by.id, name: by.name },
    );
    const startError = input.start ? fromStatus(await pollAction(poll.id, "start")) : null;
    return { ok: true, started: input.start && startError === null, startError };
  } catch (error) {
    console.error("[polls] saving failed", errorInfo(error));
    return fail("failed");
  }
}

/** Starts a saved draft, or ends a running poll now, through the bot. */
export async function runAction(id: string, action: "start" | "end"): Promise<PollActionResult> {
  const error = fromStatus(await pollAction(id, action));
  return error ? fail(error) : { ok: true };
}

/** Removes a draft or ended poll (and its post, best effort). */
export async function removePoll(id: string): Promise<PollActionResult> {
  try {
    const poll = await findPoll(id);
    if (!poll) return fail("notFound");
    if (poll.status === "active") return fail("wrongState");
    if (poll.messageId) await pollAction(id, "delete");
    if (!(await deleteInactive(id))) return fail("wrongState");
    return { ok: true };
  } catch (error) {
    console.error("[polls] removing failed", errorInfo(error));
    return fail("failed");
  }
}
