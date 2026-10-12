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
  GatewayIntentBits.GuildInvites, // not privileged: invite tracking (who invited whom)
  GatewayIntentBits.GuildMembers, // privileged: joins and leaves (welcome, auto-roles, restoring roles)
];

/** Message text is only readable with the privileged MessageContent intent, which is opt-in (DISCORD_MESSAGE_CONTENT=true) so a portal that hasn't enabled it can't stop the bot from logging in. */
export function intents(): GatewayIntentBits[] {
  return process.env.DISCORD_MESSAGE_CONTENT === "true" ? [...INTENTS, GatewayIntentBits.MessageContent] : INTENTS;
}

let client: Client | undefined;

/** Built on first use, never at import time (docker build has no env). */
export function getClient(): Client {
  if (!client) {
    client = new Client({ intents: intents(), partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User] });
    // Every module registers its own ready handler; the default of 10 is too low for that.
    client.setMaxListeners(30);
  }
  return client;
}
