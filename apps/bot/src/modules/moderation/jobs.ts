import { Events, type Client, type Guild } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { claimExpiry, createCase, listDueBans, releaseExpiry } from "./repository";
import { postCaseLog } from "./service";

// Temporary bans end by themselves. The expiry lives in the database (the ban's
// case has expiresAt), so a restart loses nothing: the job runs once at startup
// and then every minute, and lifts every ban whose time is up.

const INTERVAL_MS = 60_000;

/** Lifts every ban whose time is up. Returns how many were handled. Never throws. */
export async function liftDueBans(guild: Guild): Promise<number> {
  let handled = 0;
  try {
    const due = await listDueBans(new Date());
    for (const ban of due) {
      // Claim first: with two processes (or two overlapping rounds) only one lifts it.
      if (!(await claimExpiry(ban.id, new Date()))) continue;
      try {
        const stillBanned = await guild.bans.fetch({ user: ban.targetId, force: true }).catch(() => null);
        if (!stillBanned) {
          log.info({ case: ban.caseNumber, target: ban.targetId }, "temporary ban already lifted by hand");
          handled++;
          continue;
        }
        await guild.members.unban(ban.targetId, `Temporary ban expired (case #${ban.caseNumber})`);
        const row = await createCase({
          type: "unban",
          source: "automod",
          targetId: ban.targetId,
          targetName: ban.targetName,
          moderatorId: "system",
          moderatorName: "Temporary ban ended",
          reason: `Temporary ban (case #${ban.caseNumber}) expired`,
        });
        await postCaseLog(guild, row);
        log.info({ case: ban.caseNumber, unbanCase: row.caseNumber, target: ban.targetId }, "temporary ban lifted");
        handled++;
      } catch (err) {
        // Give the claim back so the next round tries again (missing permission, Discord hiccup).
        log.error({ err, case: ban.caseNumber }, "could not lift a temporary ban, will retry");
        await releaseExpiry(ban.id).catch(() => undefined);
      }
    }
  } catch (err) {
    log.error({ err }, "temporary ban job failed");
  }
  return handled;
}

let timer: ReturnType<typeof setInterval> | undefined;

/** Starts the job with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it acts on the real server). */
export function registerModerationJobs(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "moderation jobs: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  const run = () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (guild) void liftDueBans(guild);
  };
  client.once(Events.ClientReady, () => {
    run();
    timer = setInterval(run, INTERVAL_MS);
  });
}

export function stopModerationJobs(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
