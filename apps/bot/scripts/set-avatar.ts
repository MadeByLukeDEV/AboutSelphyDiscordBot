import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { REST, Routes } from "discord.js";
import { env } from "../src/lib/env";

// Sets the bot's Discord profile picture from apps/dashboard/public/brand/bot-avatar.png (made by
// `pnpm --filter @aboutselphy/bot brand`). Uses the REST API only, so the bot doesn't have to be
// online. Discord limits how often an avatar can change, so run it once, not in a loop.
const file = readFileSync(resolve(import.meta.dirname, "../../dashboard/public/brand/bot-avatar.png"));
const rest = new REST({ version: "10" }).setToken(env().DISCORD_BOT_TOKEN);
await rest.patch(Routes.user("@me"), { body: { avatar: `data:image/png;base64,${file.toString("base64")}` } });
console.log("bot avatar updated");
