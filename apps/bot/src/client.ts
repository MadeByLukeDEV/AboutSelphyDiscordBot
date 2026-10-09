import { Client, GatewayIntentBits } from "discord.js";

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
 */
export const INTENTS = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildModeration];

let client: Client | undefined;

/** Built on first use, never at import time (docker build has no env). */
export function getClient(): Client {
  client ??= new Client({ intents: INTENTS });
  return client;
}
