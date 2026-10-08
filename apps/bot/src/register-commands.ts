import { createHash } from "node:crypto";
import { REST, Routes } from "discord.js";
import { prisma } from "@aboutselphy/db";
import { COMMANDS } from "./commands";
import { env } from "./lib/env";
import { log } from "./lib/log";

const SETTING_KEY = "commands.hash";

/**
 * Registers the slash commands for our single guild (instant, unlike global
 * commands). Skipped when the definitions are unchanged since the last
 * registration, unless `force` is set.
 */
export async function registerCommands(force = false): Promise<"registered" | "unchanged"> {
  const e = env();
  const body = COMMANDS.map((c) => c.data);
  // The hash covers the target too: a different dev guild must re-register.
  const hash = createHash("sha256")
    .update(JSON.stringify({ guild: e.DISCORD_GUILD_ID, app: e.DISCORD_APP_ID, body }))
    .digest("hex");

  if (!force) {
    const previous = await prisma.botSetting.findUnique({ where: { key: SETTING_KEY } });
    if (previous?.value === hash) {
      log.info({ count: body.length }, "slash commands unchanged, skipping registration");
      return "unchanged";
    }
  }

  const rest = new REST({ version: "10" }).setToken(e.DISCORD_BOT_TOKEN);
  await rest.put(Routes.applicationGuildCommands(e.DISCORD_APP_ID, e.DISCORD_GUILD_ID), { body });
  await prisma.botSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: hash },
    update: { value: hash },
  });
  log.info({ count: body.length, names: body.map((b) => b.name) }, "slash commands registered");
  return "registered";
}
