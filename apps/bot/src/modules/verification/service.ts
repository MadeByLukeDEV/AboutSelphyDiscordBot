import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  type ModalSubmitInteraction,
} from "discord.js";
import type { VerificationPanelStatus } from "@aboutselphy/shared";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env, integrationsActive } from "../../lib/env";
import { truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { SlidingWindowLimiter } from "../../lib/sliding-window";
import { staffLevel } from "../../lib/permissions";
import { performAction } from "../moderation";
import { checkRole } from "../roles";
import { getVerificationConfig } from "./config";
import { setPanelMessage } from "./repository";
import { answerMatches, daysUntilOldEnough, shouldKickUnverified } from "./rules";

// The verification gate. A panel in a public channel carries one button; pressing it (and, if configured, answering a
// question typed into a small form) gives the verified role and takes the "unverified" one away. Every role change
// goes through checkRole. Wrong answers are limited (5 in 10 minutes per member). Optionally, members who joined after
// the gate was switched on and never verified are kicked after a number of hours; nobody who was already here, no bot,
// no staff and nobody with another role is ever kicked for that.

export const VERIFY_PREFIX = "vf";
const VERIFY_BUTTON_ID = `${VERIFY_PREFIX}:verify`;
const ANSWER_MODAL_ID = `${VERIFY_PREFIX}:answer`;
const ANSWER_FIELD_ID = "answer";
const NO_MENTIONS = { parse: [] as never[] };
const wrongAnswers = new SlidingWindowLimiter(5, 10 * 60_000);
const KICK_CHECK_MS = 10 * 60_000;
let kickTimer: ReturnType<typeof setInterval> | undefined;

const asText = async (guild: Guild, id: string | null): Promise<GuildTextBasedChannel | null> => {
  if (!id) return null;
  const channel = await guild.channels.fetch(id).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === guild.id && channel.isTextBased() ? (channel as GuildTextBasedChannel) : null;
};

// -- the panel ---------------------------------------------------------------------------------------

export async function postVerificationPanel(guild: Guild): Promise<VerificationPanelStatus> {
  try {
    const config = await getVerificationConfig();
    if (!config.channelId || !config.verifiedRoleId) return "needsSetup";
    const channel = await asText(guild, config.channelId);
    if (!channel || !("send" in channel)) return "channel";
    const embed = new EmbedBuilder().setColor(0x00ffa8).setTitle(truncate(config.panelTitle, 256));
    if (config.panelDescription) embed.setDescription(truncate(config.panelDescription, 4000));
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(VERIFY_BUTTON_ID).setLabel(truncate(config.buttonLabel, 80)).setStyle(ButtonStyle.Success).setEmoji("✅"));
    const payload = { embeds: [embed], components: [row], allowedMentions: NO_MENTIONS };
    if (config.panelMessageId) {
      const existing = await channel.messages.fetch(config.panelMessageId).catch(() => null);
      if (existing) {
        await existing.edit(payload);
        return "updated";
      }
    }
    const message = await channel.send(payload);
    await setPanelMessage(message.id);
    log.info({ channelId: channel.id, messageId: message.id }, "verification panel posted");
    return "posted";
  } catch (err) {
    log.error({ err }, "posting the verification panel failed");
    return "failed";
  }
}

// -- pressing the button -------------------------------------------------------------------------------

/** Gives the verified role, takes the unverified one away. Returns what to tell the member. */
async function grant(member: GuildMember, roleId: string, unverifiedRoleId: string | null): Promise<string> {
  if (checkRole(member.guild, roleId) !== "ok") {
    log.warn({ roleId }, "verification: the verified role can't be handed out (missing, too high or too powerful)");
    return "I can't give the role right now. Please tell a moderator.";
  }
  await member.roles.add(roleId, "Verified");
  if (unverifiedRoleId && member.roles.cache.has(unverifiedRoleId) && checkRole(member.guild, unverifiedRoleId) === "ok") {
    await member.roles.remove(unverifiedRoleId, "Verified").catch((err) => log.warn({ err }, "verification: could not take the unverified role"));
  }
  log.info({ user: member.id }, "verification: member verified");
  return "You're verified. Welcome!";
}

async function onButton(i: ButtonInteraction<"cached">): Promise<void> {
  const config = await getVerificationConfig();
  const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  if (!config.enabled || !config.verifiedRoleId) return void (await reply("Verification isn't switched on right now."));
  if (i.member.roles.cache.has(config.verifiedRoleId)) return void (await reply("You're already verified."));

  const wait = daysUntilOldEnough(i.user.createdAt, new Date(), config.minAccountAgeDays);
  if (wait > 0) return void (await reply(`Your Discord account is too new to verify yet. Please come back in ${wait} ${wait === 1 ? "day" : "days"}.`));

  // With a question the first answer to the press must be the form itself.
  if (config.question) {
    const field = new TextInputBuilder().setCustomId(ANSWER_FIELD_ID).setLabel(truncate(config.question, 45)).setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100);
    return void (await i.showModal(new ModalBuilder().setCustomId(ANSWER_MODAL_ID).setTitle("Verify").addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(field))));
  }
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  await i.editReply({ content: await grant(i.member, config.verifiedRoleId, config.unverifiedRoleId) });
}

async function onAnswer(i: ModalSubmitInteraction<"cached">): Promise<void> {
  const config = await getVerificationConfig();
  const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  if (!config.enabled || !config.verifiedRoleId || !config.question) return void (await reply("Verification isn't switched on right now."));
  if (i.member.roles.cache.has(config.verifiedRoleId)) return void (await reply("You're already verified."));
  if (daysUntilOldEnough(i.user.createdAt, new Date(), config.minAccountAgeDays) > 0) return void (await reply("Your Discord account is too new to verify yet."));

  if (!answerMatches(i.fields.getTextInputValue(ANSWER_FIELD_ID), config.answer)) {
    // A wrong answer costs one of five tries per ten minutes, so the answer can't be guessed in a loop.
    if (!wrongAnswers.tryAcquire(i.user.id)) return void (await reply("Too many wrong answers. Please wait a few minutes and try again."));
    return void (await reply("That isn't right. Read the rules and try again."));
  }
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  await i.editReply({ content: await grant(i.member, config.verifiedRoleId, config.unverifiedRoleId) });
}

async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID) return;
  if (i.isButton() && i.customId === VERIFY_BUTTON_ID) return onButton(i);
  if (i.isModalSubmit() && i.customId === ANSWER_MODAL_ID) return onAnswer(i);
}

export function registerVerificationControls(): void {
  onComponent(VERIFY_PREFIX, handle);
}

// -- joins and the kick job ---------------------------------------------------------------------------------

async function onJoin(member: GuildMember): Promise<void> {
  if (member.guild.id !== env().DISCORD_GUILD_ID || member.user.bot) return;
  const config = await getVerificationConfig();
  if (!config.enabled || !config.unverifiedRoleId) return;
  if (checkRole(member.guild, config.unverifiedRoleId) !== "ok") return void log.warn({ roleId: config.unverifiedRoleId }, "verification: the unverified role can't be handed out");
  await member.roles.add(config.unverifiedRoleId, "Joined: waiting for verification");
  log.info({ user: member.id }, "verification: unverified role given");
}

/** Kicks members who joined after the gate was switched on and never verified in time (only with kickAfterHours > 0). */
export async function kickUnverified(guild: Guild): Promise<void> {
  const config = await getVerificationConfig();
  if (!config.enabled || !config.verifiedRoleId || config.kickAfterHours <= 0 || !config.enabledAt) return;
  const members = await guild.members.fetch();
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const now = new Date();
  for (const member of members.values()) {
    const others = member.roles.cache.filter((r) => r.id !== guild.id && r.id !== config.unverifiedRoleId).size;
    const candidate = { isBot: member.user.bot, isStaff: staffLevel(member) !== null, hasVerifiedRole: member.roles.cache.has(config.verifiedRoleId), otherRoleCount: others, joinedAt: member.joinedAt };
    if (!shouldKickUnverified(candidate, config.enabledAt, now, config.kickAfterHours)) continue;
    const result = await performAction({ guild, moderator: me, type: "kick", targetId: member.id, targetUser: member.user, reason: `Didn't verify within ${config.kickAfterHours} hours`, source: "automod" });
    log.info({ user: member.id, ok: result.ok }, "verification: kicked an unverified member");
  }
}

/** Starts the gate with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it changes roles and kicks real members). */
export function startVerification(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "verification: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.on(Events.GuildMemberAdd, (member) => void onJoin(member).catch((err) => log.error({ err }, "verification join handler failed")));
  client.once(Events.ClientReady, () => {
    kickTimer = setInterval(() => {
      const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
      if (guild) void kickUnverified(guild).catch((err) => log.error({ err }, "verification kick job failed"));
    }, KICK_CHECK_MS);
    kickTimer.unref();
  });
}

export function stopVerification(): void {
  clearInterval(kickTimer);
  kickTimer = undefined;
}

