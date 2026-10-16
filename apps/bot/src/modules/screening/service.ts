import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  MessageFlags,
  type ButtonInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
} from "discord.js";
import type { ScreeningDecision, ScreeningDecideStatus } from "@aboutselphy/shared/screening";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env, integrationsActive } from "../../lib/env";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { staffLevel } from "../../lib/permissions";
import { performAction } from "../moderation";
import { checkRole } from "../roles";
import { getScreeningConfig } from "./config";
import { createEntry, decide, findEntry, listStalePending, markLeft, setCard } from "./repository";
import { REJECT_REASON, SCREENING_PREFIX, canDecide, parseScreeningControl, waitedTooLong, screeningControlId, statusAfter } from "./rules";

// The manual screening queue. A new member (not a bot) gets a card in the staff channel with Approve and Reject buttons;
// optionally they wear a "pending" role meanwhile. Approve gives the approved role and takes the pending one away;
// Reject kicks (recorded as a moderation case). Only staff can press the buttons (checked again on every press), a decision
// is one conditional UPDATE so it happens once, and a member who leaves while waiting is marked "left".

const NO_MENTIONS = { parse: [] as never[] };
const COLORS = { pending: 0xfee75c, approved: 0x00ffa8, rejected: 0xed4245, left: 0x99aab5 } as const;

type Card = { userId: string; userName: string; accountCreatedAt: Date; joinedAt: Date; status: "pending" | "approved" | "rejected" | "left"; decidedByName?: string | null };

function cardEmbed(c: Card): EmbedBuilder {
  const ts = (d: Date) => `<t:${Math.floor(d.getTime() / 1000)}:R>`;
  const embed = new EmbedBuilder()
    .setColor(COLORS[c.status])
    .setTitle(c.status === "pending" ? "New member waiting for approval" : `New member: ${c.status}`)
    .setDescription(`<@${c.userId}> (${escapeText(truncate(c.userName, 100))})\nID \`${c.userId}\``)
    .addFields({ name: "Account created", value: ts(c.accountCreatedAt), inline: true }, { name: "Joined", value: ts(c.joinedAt), inline: true });
  if (c.status !== "pending" && c.decidedByName) embed.addFields({ name: "Decided by", value: escapeText(truncate(c.decidedByName, 100)), inline: true });
  return embed;
}

const buttons = (id: string, disabled = false) =>
  new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(screeningControlId("approve", id)).setLabel("Approve").setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId(screeningControlId("reject", id)).setLabel("Reject (kick)").setStyle(ButtonStyle.Danger).setDisabled(disabled),
  );

// -- a member joins ---------------------------------------------------------------------------------

async function onJoin(member: GuildMember): Promise<void> {
  if (member.guild.id !== env().DISCORD_GUILD_ID || member.user.bot) return;
  const config = await getScreeningConfig();
  if (!config.enabled || !config.channelId || !config.approvedRoleId) return;
  const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased() || !("send" in channel)) return void log.warn({ channelId: config.channelId }, "screening: the staff channel is missing");

  if (config.pendingRoleId) {
    if (checkRole(member.guild, config.pendingRoleId) === "ok") await member.roles.add(config.pendingRoleId, "Joined: waiting for screening").catch((err) => log.warn({ err }, "screening: could not give the pending role"));
    else log.warn({ roleId: config.pendingRoleId }, "screening: the pending role can't be handed out");
  }
  const entry = await createEntry({ userId: member.id, userName: member.user.username, accountCreatedAt: member.user.createdAt, channelId: channel.id });
  const message = await channel.send({ embeds: [cardEmbed({ ...entry, status: "pending" })], components: [buttons(entry.id)], allowedMentions: NO_MENTIONS });
  await setCard(entry.id, message.id);
  log.info({ user: member.id, entry: entry.id }, "screening: card posted");
}

async function onLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.guild.id !== env().DISCORD_GUILD_ID) return;
  for (const entry of await markLeft(member.id)) {
    if (!entry.channelId || !entry.messageId) continue;
    const channel = await member.guild.channels.fetch(entry.channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) continue;
    const message = await channel.messages.fetch(entry.messageId).catch(() => null);
    await message?.edit({ embeds: [cardEmbed({ ...entry, status: "left" })], components: [buttons(entry.id, true)], allowedMentions: NO_MENTIONS }).catch(() => undefined);
    log.info({ user: member.id, entry: entry.id }, "screening: member left while waiting");
  }
}

// -- a decision ---------------------------------------------------------------------------------------

/** Decides one entry as `staffName`; `moderator` is the staff member who pressed the button (the bot itself for a dashboard decision). */
export async function decideEntry(guild: Guild, id: string, decision: ScreeningDecision, staffName: string, moderator: GuildMember | null): Promise<ScreeningDecideStatus> {
  const entry = await findEntry(id);
  if (!entry) return "notFound";
  if (!canDecide(entry.status)) return "alreadyDecided";
  const config = await getScreeningConfig();

  const member = await guild.members.fetch(entry.userId).catch(() => null);
  if (!member) {
    // They left meanwhile: nothing to approve or kick.
    if (await decide(id, "left", staffName)) await refreshCard(guild, id, "left", staffName);
    return "alreadyDecided";
  }
  if (!(await decide(id, statusAfter(decision), staffName))) return "alreadyDecided";

  try {
    if (decision === "approve") {
      if (!config.approvedRoleId || checkRole(guild, config.approvedRoleId) !== "ok") throw new Error("approved role can't be handed out");
      await member.roles.add(config.approvedRoleId, `Approved by ${staffName}`);
      if (config.pendingRoleId && member.roles.cache.has(config.pendingRoleId) && checkRole(guild, config.pendingRoleId) === "ok") {
        await member.roles.remove(config.pendingRoleId, `Approved by ${staffName}`).catch((err) => log.warn({ err }, "screening: could not take the pending role"));
      }
    } else {
      const me = guild.members.me ?? (await guild.members.fetchMe());
      const result = await performAction({
        guild,
        moderator: moderator ?? me,
        type: "kick",
        targetId: member.id,
        targetUser: member.user,
        reason: REJECT_REASON,
        source: "automod",
        ...(moderator ? {} : { actor: { id: "system", name: staffName } }),
      });
      if (!result.ok) throw new Error(result.message);
    }
  } catch (err) {
    log.error({ err, entry: id, decision }, "screening: applying the decision failed");
    return "failed";
  }
  await refreshCard(guild, id, statusAfter(decision), staffName);
  log.info({ entry: id, decision, by: staffName }, "screening: decided");
  return "done";
}

async function refreshCard(guild: Guild, id: string, status: Card["status"], staffName: string): Promise<void> {
  const entry = await findEntry(id);
  if (!entry?.channelId || !entry.messageId) return;
  const channel = await guild.channels.fetch(entry.channelId).catch(() => null);
  if (!channel || !channel.isTextBased() || channel.isDMBased()) return;
  const message = await channel.messages.fetch(entry.messageId).catch(() => null);
  await message?.edit({ embeds: [cardEmbed({ ...entry, status, decidedByName: staffName })], components: [buttons(id, true)], allowedMentions: NO_MENTIONS }).catch((err) => log.warn({ err }, "screening: could not update the card"));
}

// -- the buttons ----------------------------------------------------------------------------------------

async function onButton(i: ButtonInteraction<"cached">): Promise<void> {
  const parsed = parseScreeningControl(i.customId);
  const reply = (content: string) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS });
  if (!parsed) return void (await reply("That button isn't valid any more."));
  // Staff only, checked on every press: the channel's visibility is not the boundary.
  if (staffLevel(i.member) === null) return void (await reply("Only the team can decide this."));
  const entry = await findEntry(parsed.id);
  if (!entry || entry.messageId !== i.message.id) return void (await reply("That entry doesn't exist any more."));

  await i.deferReply({ flags: MessageFlags.Ephemeral });
  const status = await decideEntry(i.guild, parsed.id, parsed.decision, i.user.username, i.member);
  const text: Record<ScreeningDecideStatus, string> = {
    done: parsed.decision === "approve" ? "Approved." : "Rejected and kicked.",
    notFound: "That entry doesn't exist any more.",
    alreadyDecided: "Someone already decided this (or the member left).",
    failed: "Something went wrong. Check my permissions and role position, then try again.",
  };
  await i.editReply({ content: text[status], allowedMentions: NO_MENTIONS });
}

async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID) return;
  if (i.isButton()) return onButton(i);
}

export function registerScreeningControls(): void {
  onComponent(SCREENING_PREFIX, handle);
}

const AUTO_REJECT_EVERY_MS = 30 * 60_000;
let autoTimer: ReturnType<typeof setInterval> | undefined;

/** Rejects (kicks) members nobody decided on within the configured days. Off unless the admin set a number of days. Each goes through the normal decision, so the card, the case and the log are the same as for a hand decision. */
async function autoRejectRound(client: Client): Promise<void> {
  const config = await getScreeningConfig();
  if (!config.enabled || config.autoRejectDays <= 0) return;
  const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
  if (!guild) return;
  const now = new Date();
  for (const entry of await listStalePending(new Date(now.getTime() - config.autoRejectDays * 86_400_000))) {
    if (!waitedTooLong(entry.joinedAt, config.autoRejectDays, now)) continue;
    const status = await decideEntry(guild, entry.id, "reject", "Automatic (waited too long)", null);
    log.info({ entry: entry.id, status, days: config.autoRejectDays }, "screening: auto-reject");
  }
}

/** Starts with the bot. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true (it gives roles and kicks real members). */
export function startScreening(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "screening: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.on(Events.GuildMemberAdd, (member) => void onJoin(member).catch((err) => log.error({ err }, "screening join handler failed")));
  client.on(Events.GuildMemberRemove, (member) => void onLeave(member).catch((err) => log.error({ err }, "screening leave handler failed")));
  autoTimer = setInterval(() => void autoRejectRound(client).catch((err) => log.error({ err }, "screening: auto-reject round failed")), AUTO_REJECT_EVERY_MS);
}

export function stopScreening(): void {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = undefined;
}
