import { prisma } from "@aboutselphy/db";
import { getClient } from "./client";
import { registerInteractionCreate } from "./events/interaction-create";
import { registerLifecycle } from "./events/lifecycle";
import { registerReactionRoles, registerRolePanels } from "./modules/roles";
import { registerGiveawayControls, startGiveaways, stopGiveaways } from "./modules/giveaways";
import { registerLevels, stopLevels } from "./modules/levels";
import { registerPollControls, startPolls, stopPolls } from "./modules/polls";
import { startBirthdays, stopBirthdays } from "./modules/birthdays";
import { startReminders, stopReminders } from "./modules/reminders";
import { startAutoPublish } from "./modules/autopublish";
import { startFeeds, stopFeeds } from "./modules/feeds";
import { startAutoResponders } from "./modules/autoresponders";
import { startCounting } from "./modules/counting";
import { startSticky, stopSticky } from "./modules/sticky";
import { startEmotes } from "./lib/emotes";
import { loginWithRetry } from "./lib/login";
import { startAntiBot } from "./modules/antibot";
import { startTwitchVip, stopTwitchVip } from "./modules/twitchvip";
import { startRetention, stopRetention } from "./modules/privacy";
import { startInvites } from "./modules/invites";
import { registerVerificationControls, startVerification, stopVerification } from "./modules/verification";
import { startRaidProtection, stopRaidProtection } from "./modules/raid";
import { registerStarboard } from "./modules/starboard";
import { startStatChannels, stopStatChannels } from "./modules/statchannels";
import { registerSuggestionControls } from "./modules/suggestions";
import { registerTicketControls, registerTicketEvents } from "./modules/tickets";
import { registerLogs } from "./modules/logs";
import { registerWelcome } from "./modules/welcome";
import { startAnnouncements, stopAnnouncements } from "./modules/announcements";
import { registerAuditLog, registerModerationJobs, stopModerationJobs } from "./modules/moderation";
import { registerTempVoice } from "./modules/tempvoice";
import { startTwitch, stopTwitch } from "./modules/twitch";
import { startYoutube, stopYoutube } from "./modules/youtube";
import { startInternalApi } from "./internal-api/server";
import { env, integrationsActive } from "./lib/env";
import { log } from "./lib/log";
import { registerCommands } from "./register-commands";

async function main() {
  const e = env(); // fail fast on bad config, naming the variables
  log.info(
    { env: e.BOT_ENV, schema: e.DATABASE_SCHEMA, integrations: integrationsActive() },
    "starting bot",
  );

  // Health endpoint first, so the container reports "unhealthy" (not "dead")
  // while the gateway is still connecting.
  const api = startInternalApi();

  await registerCommands();

  const client = getClient();
  registerLifecycle(client);
  registerInteractionCreate(client);
  registerAuditLog(client);
  registerModerationJobs(client);
  registerTempVoice(client);
  registerRolePanels();
  registerReactionRoles(client);
  registerWelcome(client);
  registerLogs(client);
  registerLevels(client);
  registerGiveawayControls();
  startGiveaways(client);
  registerTicketControls();
  registerSuggestionControls();
  registerPollControls();
  registerStarboard(client);
  startBirthdays(client);
  startReminders(client);
  startStatChannels(client);
  startSticky(client);
  startAntiBot(client);
  startTwitchVip(client);
  startRetention(client);
  startInvites(client);
  registerVerificationControls();
  startVerification(client);
  startRaidProtection(client);
  startAutoPublish(client);
  startFeeds(client);
  startCounting(client);
  startAutoResponders(client);
  startPolls(client);
  registerTicketEvents(client);
  startTwitch(client);
  startAnnouncements(client);
  startYoutube(client);
  startEmotes(client);
  await loginWithRetry(client, e.DISCORD_BOT_TOKEN);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, "shutting down");
    api.close();
    stopTwitch();
    stopAnnouncements();
    stopLevels();
    stopGiveaways();
    stopPolls();
    stopBirthdays();
    stopReminders();
    stopStatChannels();
    stopSticky();
    stopTwitchVip();
    stopRetention();
    stopVerification();
    stopRaidProtection();
    stopFeeds();
    stopYoutube();
    stopModerationJobs();
    await client.destroy();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

process.on("unhandledRejection", (err) => log.error({ err }, "unhandled rejection"));

main().catch((err) => {
  log.fatal({ err }, "bot failed to start");
  process.exit(1);
});
