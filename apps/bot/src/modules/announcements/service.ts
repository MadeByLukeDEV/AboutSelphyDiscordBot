import { Events, type Client } from "discord.js";
import type { AnnouncementDeleteStatus, AnnouncementEditStatus } from "@aboutselphy/shared";
import { nextRun, type Repeat } from "@aboutselphy/shared/announcement";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { buildAnnouncement } from "./message";
import { claim, failStuck, find, listDue, markFailed, markRescheduled, markSent } from "./repository";

// Sending announcements. The dashboard writes a row (status "scheduled", with the
// time to send) and nudges the bot; the bot also checks on its own every 30 s, so a
// missed nudge or a restart only delays a post. Each row is claimed atomically
// before it is posted, so it is never posted twice.

const INTERVAL_MS = 30_000;
const STUCK_AFTER_MS = 5 * 60_000;

let discord: Client | undefined;
let running = false;

/** Why a send failed, as a short code for the dashboard (never Discord's own text). */
function failureCode(err: unknown): string {
  const code = (err as { code?: number } | null)?.code;
  if (code === 50001 || code === 50013) return "permissions";
  if (code === 10003) return "channel";
  return "discord";
}

/** Posts every announcement that is due. Returns how many were handled. Never throws. */
export async function processDue(): Promise<number> {
  if (running || !discord) return 0; // one round at a time
  running = true;
  let handled = 0;
  try {
    const stuck = await failStuck(new Date(Date.now() - STUCK_AFTER_MS));
    if (stuck > 0) log.warn({ stuck }, "announcements: marked interrupted sends as failed");

    for (const row of await listDue(new Date())) {
      if (!(await claim(row.id))) continue;
      try {
        const channel = await discord.channels.fetch(row.channelId).catch(() => null);
        if (!channel || channel.isDMBased() || channel.guildId !== env().DISCORD_GUILD_ID || !channel.isTextBased() || !("send" in channel)) {
          await markFailed(row.id, "channel");
          log.warn({ id: row.id, channelId: row.channelId }, "announcements: channel missing or not a text channel");
          continue;
        }
        const message = await channel.send(buildAnnouncement(row));
        const now = new Date();
        // A recurring announcement goes back to "scheduled" for its next time, unless that is past its end.
        const next = row.repeat !== "none" && row.scheduledFor ? nextRun(row.scheduledFor, row.repeat as Exclude<Repeat, "none">, now) : null;
        if (next && (!row.repeatUntil || next.getTime() <= row.repeatUntil.getTime())) {
          await markRescheduled(row.id, message.id, now, next);
          log.info({ id: row.id, messageId: message.id, next: next.toISOString() }, "announcements: sent (recurring), next round scheduled");
        } else {
          await markSent(row.id, message.id, now);
          log.info({ id: row.id, channelId: row.channelId, messageId: message.id }, "announcements: sent");
        }
        handled++;
      } catch (err) {
        const code = failureCode(err);
        log.error({ err, id: row.id, code }, "announcements: sending failed");
        await markFailed(row.id, code).catch(() => undefined);
      }
    }
  } catch (err) {
    log.error({ err }, "announcements: round failed");
  } finally {
    running = false;
  }
  return handled;
}

async function sentMessage(id: string) {
  const row = await find(id);
  if (!row || row.status !== "sent" || !row.messageId) return { row, message: undefined, gone: false };
  const channel = await discord?.channels.fetch(row.channelId).catch(() => null);
  if (!channel || channel.isDMBased() || !channel.isTextBased()) return { row, message: undefined, gone: true };
  const message = await channel.messages.fetch(row.messageId).catch(() => null);
  return { row, message: message ?? undefined, gone: message === null };
}

/** Re-renders a sent announcement's Discord message from its row (after an edit in the dashboard). */
export async function editSent(id: string): Promise<AnnouncementEditStatus> {
  try {
    const { row, message, gone } = await sentMessage(id);
    if (!row || row.status !== "sent") return "not-sent";
    if (!message || gone) return "message-gone";
    const { content, embeds, allowedMentions } = buildAnnouncement(row);
    await message.edit({ content, embeds, allowedMentions });
    log.info({ id }, "announcements: edited");
    return "edited";
  } catch (err) {
    log.error({ err, id }, "announcements: edit failed");
    return "failed";
  }
}

/** Deletes a sent announcement's Discord message. The dashboard removes the row. */
export async function deleteSent(id: string): Promise<AnnouncementDeleteStatus> {
  try {
    const { row, message, gone } = await sentMessage(id);
    if (!row || row.status !== "sent") return "not-sent";
    if (!message || gone) return "already-gone";
    await message.delete();
    log.info({ id }, "announcements: deleted");
    return "deleted";
  } catch (err) {
    log.error({ err, id }, "announcements: delete failed");
    return "failed";
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Starts the sender with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it posts on the real server). */
export function startAnnouncements(client: Client): void {
  discord = client;
  if (!integrationsActive()) {
    log.info({}, "announcements: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  // The dashboard nudges the bot right after saving, so "send now" doesn't wait for the next round.
  onReload("announcements", () => void processDue());
  client.once(Events.ClientReady, () => {
    if (!client.guilds.cache.has(env().DISCORD_GUILD_ID)) log.warn({}, "announcements: bot is not in the configured guild");
    void processDue();
    timer = setInterval(() => void processDue(), INTERVAL_MS);
  });
}

export function stopAnnouncements(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
