import { Events, type Client, type Guild } from "discord.js";
import { onReload } from "../../internal-api/reload";
import { integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { unlinkMember } from "../twitchvip";
import { deleteMember, prune, readRetention, recordRun, type DeleteCounts } from "./repository";
import { cutoff, describeRun } from "./rules";

/** An admin erases one member's data on request: the same removal as the member's own /mydata delete (cases and tickets stay). The Twitch link goes first so the VIP role comes off. */
export async function eraseMember(guild: Guild, userId: string): Promise<{ counts: DeleteCounts; twitchLinkRemoved: boolean }> {
  const twitchLinkRemoved = await unlinkMember(guild, userId);
  const counts = await deleteMember(userId);
  log.info({ user: userId, ...counts, twitchLinkRemoved }, "privacy: erased on request");
  return { counts, twitchLinkRemoved };
}

// Data retention. Once a day (and when the dashboard saves new settings) the bot removes personal data older than the
// limits an admin set; every limit is 0 (keep) until they choose one. Nothing here runs in a local development run
// unless BOT_INTEGRATIONS_IN_DEV=true, because it deletes rows of the real database.

const INTERVAL_MS = 24 * 3_600_000;
const mutex = new KeyedMutex();
let timer: ReturnType<typeof setInterval> | undefined;

export function pruneNow(): Promise<void> {
  return mutex.run("prune", async () => {
    try {
      const config = await readRetention();
      const now = new Date();
      const cuts = { transcript: cutoff(config.ticketTranscriptDays, now), cases: cutoff(config.caseDays, now), suggestions: cutoff(config.suggestionDays, now), xp: cutoff(config.inactiveXpDays, now), polls: cutoff(config.pollDays, now), giveaways: cutoff(config.giveawayDays, now), starboard: cutoff(config.starboardDays, now) };
      // prune() always clears the audit trail after a year, so it runs even when every limit is off.
      const result = await prune(cuts, now);
      if (Object.values(cuts).every((c) => !c)) return void log.info({}, "retention: every limit is off, only the audit trail was cleaned");
      await recordRun(describeRun(result));
      log.info({ ...result }, "retention: removed old data");
    } catch (err) {
      log.error({ err }, "retention: the daily clean-up failed");
    }
  });
}

/** Starts the daily clean-up with the bot. */
export function startRetention(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "retention: not running (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  onReload("retention", () => void pruneNow());
  client.once(Events.ClientReady, () => {
    setTimeout(() => void pruneNow(), 60_000).unref();
    timer = setInterval(() => void pruneNow(), INTERVAL_MS);
    timer.unref();
  });
}

export function stopRetention(): void {
  clearInterval(timer);
  timer = undefined;
}

