import { prisma } from "@aboutselphy/db";
import { getClient } from "./client";
import { registerInteractionCreate } from "./events/interaction-create";
import { registerLifecycle } from "./events/lifecycle";
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
  await client.login(e.DISCORD_BOT_TOKEN);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info({ signal }, "shutting down");
    api.close();
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
