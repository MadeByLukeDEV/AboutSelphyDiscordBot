import { EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";

// The log entries. Built from plain data so they are easy to test. Names of users, channels and
// roles are chosen by other people, so they are escaped; a person is shown as a mention plus the raw
// id, and no log entry can ping anyone (they are sent with no allowed mentions).

const COLORS = { good: 0x2ecc71, bad: 0xe74c3c, info: 0x3498db, warn: 0xf5b942, neutral: 0x95a5a6 } as const;
const NEW_ACCOUNT_MS = 7 * 86_400_000;
const unix = (d: Date) => Math.floor(d.getTime() / 1000);

export const isNewAccount = (createdAt: Date, now: Date) => now.getTime() - createdAt.getTime() < NEW_ACCOUNT_MS;

const who = (id: string, name: string) => `<@${id}> (${escapeText(name)})\n\`${id}\``;
const list = (names: string[], max = 15) => (names.length === 0 ? "none" : truncate(names.slice(0, max).map(escapeText).join(", ") + (names.length > max ? ` and ${names.length - max} more` : ""), 1000));

export function memberJoinEmbed(m: { id: string; name: string; createdAt: Date; memberCount: number; bot: boolean; now?: Date }) {
  const fresh = isNewAccount(m.createdAt, m.now ?? new Date());
  return new EmbedBuilder()
    .setColor(fresh ? COLORS.warn : COLORS.good)
    .setTitle(m.bot ? "Bot added" : "Member joined")
    .setDescription(who(m.id, m.name))
    .addFields(
      { name: "Account created", value: `<t:${unix(m.createdAt)}:R>${fresh ? "\n⚠ New account" : ""}`, inline: true },
      { name: "Members now", value: String(m.memberCount), inline: true },
    )
    .setTimestamp();
}

export function memberLeaveEmbed(m: { id: string; name: string; joinedAt: Date | null; roleNames: string[]; memberCount: number }) {
  return new EmbedBuilder()
    .setColor(COLORS.bad)
    .setTitle("Member left")
    .setDescription(who(m.id, m.name))
    .addFields(
      { name: "Joined", value: m.joinedAt ? `<t:${unix(m.joinedAt)}:R>` : "unknown", inline: true },
      { name: "Members now", value: String(m.memberCount), inline: true },
      { name: "Roles", value: list(m.roleNames) },
    )
    .setTimestamp();
}

export function nicknameEmbed(m: { id: string; name: string; before: string | null; after: string | null }) {
  const show = (v: string | null) => (v ? escapeText(truncate(v, 100)) : "*none*");
  return new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle("Nickname changed")
    .setDescription(who(m.id, m.name))
    .addFields({ name: "Before", value: show(m.before), inline: true }, { name: "After", value: show(m.after), inline: true })
    .setTimestamp();
}

export function memberRolesEmbed(m: { id: string; name: string; added: string[]; removed: string[] }) {
  const embed = new EmbedBuilder().setColor(COLORS.info).setTitle("Roles changed").setDescription(who(m.id, m.name)).setTimestamp();
  if (m.added.length) embed.addFields({ name: "Added", value: list(m.added) });
  if (m.removed.length) embed.addFields({ name: "Removed", value: list(m.removed) });
  return embed;
}

export function voiceEmbed(m: { id: string; name: string; kind: "join" | "leave" | "move"; from: string | null; to: string | null }) {
  const title = m.kind === "join" ? "Joined a voice channel" : m.kind === "leave" ? "Left a voice channel" : "Moved voice channel";
  const embed = new EmbedBuilder()
    .setColor(m.kind === "join" ? COLORS.good : m.kind === "leave" ? COLORS.bad : COLORS.info)
    .setTitle(title)
    .setDescription(who(m.id, m.name))
    .setTimestamp();
  if (m.from) embed.addFields({ name: "From", value: escapeText(truncate(m.from, 100)), inline: true });
  if (m.to) embed.addFields({ name: "To", value: escapeText(truncate(m.to, 100)), inline: true });
  return embed;
}

export function channelEmbed(m: { kind: "create" | "delete" | "rename"; name: string; type: string; before?: string }) {
  const embed = new EmbedBuilder()
    .setColor(m.kind === "create" ? COLORS.good : m.kind === "delete" ? COLORS.bad : COLORS.info)
    .setTitle(m.kind === "create" ? "Channel created" : m.kind === "delete" ? "Channel deleted" : "Channel renamed")
    .setTimestamp();
  if (m.kind === "rename") embed.addFields({ name: "Before", value: escapeText(truncate(m.before ?? "", 100)), inline: true }, { name: "After", value: escapeText(truncate(m.name, 100)), inline: true });
  else embed.setDescription(escapeText(truncate(m.name, 100)));
  embed.addFields({ name: "Type", value: m.type, inline: true });
  return embed;
}

export function roleEmbed(m: { kind: "create" | "delete" | "update"; name: string; before?: string; permissionsChanged?: boolean; colorChanged?: boolean }) {
  const embed = new EmbedBuilder()
    .setColor(m.kind === "create" ? COLORS.good : m.kind === "delete" ? COLORS.bad : COLORS.info)
    .setTitle(m.kind === "create" ? "Role created" : m.kind === "delete" ? "Role deleted" : "Role changed")
    .setDescription(escapeText(truncate(m.name, 100)))
    .setTimestamp();
  if (m.kind === "update") {
    if (m.before !== undefined && m.before !== m.name) embed.addFields({ name: "Renamed from", value: escapeText(truncate(m.before, 100)), inline: true });
    if (m.permissionsChanged) embed.addFields({ name: "Permissions", value: "changed ⚠", inline: true });
    if (m.colorChanged) embed.addFields({ name: "Colour", value: "changed", inline: true });
  }
  return embed;
}
