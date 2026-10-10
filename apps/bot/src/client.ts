import { Client, GatewayIntentBits, Partials } from "discord.js";

/**
 * Intents are added with the feature that needs them, so a missing privileged
 * intent in the Developer Portal can't stop an unrelated feature from going
 * live. Privileged ones (enable under Bot -> Privileged Gateway Intents) are
 * marked.
 *
 *   Phase 0  Guilds
 *   Phase 1  GuildModeration (audit log entries), GuildMembers* (later: joins/leaves log)
 *   Phase 2  GuildMessages, MessageContent*
 *   Phase 4  GuildVoiceStates
 *   Roles    GuildMessageReactions (reaction roles)
 *   Welcome  GuildMembers* (joins and leaves)
 *   Levels   GuildMessages (message counts only; MessageContent is NOT used)
 */
export const INTENTS = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildModeration,
  GatewayIntentBits.GuildVoiceStates,
  GatewayIntentBits.GuildMessageReactions, // role panels in reaction mode
  GatewayIntentBits.GuildMessages, // leveling counts messages (their text is not read)
  GatewayIntentBits.GuildMembers, // privileged: joins and leaves (welcome, auto-roles, restoring roles)
];

let client: Client | undefined;

/** Built on first use, never at import time (docker build has no env). */
export function getClient(): Client {
  client ??= new Client({ intents: INTENTS, partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User] });
  return client;
}
