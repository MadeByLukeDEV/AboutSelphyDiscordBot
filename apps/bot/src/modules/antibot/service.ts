import { EmbedBuilder, Events, PermissionFlagsBits, type Client, type Message } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { staffLevel } from "../../lib/permissions";
import { performAction, postModNote } from "../moderation";
import { getAntiBotConfig } from "./config";
import { recordHit } from "./repository";
import { CASE_REASON, judge } from "./rules";

// The anti-bot channel. Anyone who writes in the chosen channel loses the message, is timed out and then
// kicked, each as a normal numbered case from the bot (source "automod") in the mod log. Staff, the owner,
// bots and people with Administrator/Manage Server are left alone, so they can explain the channel or clean
// it up. One member at a time (KeyedMutex): a burst of messages gets one timeout and one kick, but every
// message is still deleted. Dry run only logs and tells the mod log what would have happened.
// Needs: Manage Messages in the channel, Moderate Members and Kick Members.

const mutex = new KeyedMutex();

async function handle(message: Message): Promise<void> {
  const guild = message.guild;
  if (!guild) return;
  const config = await getAntiBotConfig();
  if (!config.enabled || !config.channelId || message.channelId !== config.channelId) return;

  const member = message.member ?? (await guild.members.fetch(message.author.id).catch(() => null));
  const verdict = judge({
    automated: message.author.bot || message.system || message.webhookId !== null,
    owner: message.author.id === guild.ownerId,
    staff: staffLevel(member),
    powerful: Boolean(member?.permissions.has(PermissionFlagsBits.Administrator) || member?.permissions.has(PermissionFlagsBits.ManageGuild)),
  });
  if (!verdict.act) {
    log.info({ author: message.author.id, reason: verdict.reason }, "antibot: message left alone");
    return;
  }

  if (config.dryRun) {
    log.info({ author: message.author.id, timeoutSeconds: config.timeoutSeconds }, "antibot: dry run, would delete, time out and kick");
    await postModNote(guild, new EmbedBuilder().setColor(0xf59e0b).setTitle("Anti-bot channel (dry run)").setDescription(`<@${message.author.id}> (${message.author.id}) wrote in <#${message.channelId}>. Nothing was done; with the dry run off they would be timed out and kicked.`));
    return;
  }

  // Every message goes, even after the member is already handled (a bot posts in bursts).
  await message.delete().catch((err) => log.warn({ err, channelId: message.channelId }, "antibot: could not delete the message (needs Manage Messages)"));

  await mutex.run(message.author.id, async () => {
    const present = member ?? (await guild.members.fetch(message.author.id).catch(() => null));
    if (!present) {
      log.info({ author: message.author.id }, "antibot: already gone, nothing more to do");
      return;
    }
    const me = guild.members.me ?? (await guild.members.fetchMe());
    const base = { guild, moderator: me, targetId: present.id, targetUser: present.user, reason: CASE_REASON, source: "automod" as const };

    const timeout = await performAction({ ...base, type: "timeout", durationSeconds: config.timeoutSeconds });
    log.info({ author: present.id, ok: timeout.ok, message: timeout.ok ? timeout.caseNumber : timeout.message }, "antibot: timeout");
    // The kick is tried even if the timeout was refused: leaving is what matters.
    const kick = await performAction({ ...base, type: "kick" });
    log.info({ author: present.id, ok: kick.ok, message: kick.ok ? kick.caseNumber : kick.message }, "antibot: kick");
    if (timeout.ok || kick.ok) void recordHit().catch((err) => log.warn({ err }, "antibot: could not count the hit"));
  });
}

/** Starts watching. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it kicks real members). */
export function startAntiBot(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "antibot: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.on(Events.MessageCreate, (message) => {
    if (message.guildId !== env().DISCORD_GUILD_ID) return;
    void handle(message).catch((err) => log.error({ err }, "antibot: handler failed"));
  });
}
