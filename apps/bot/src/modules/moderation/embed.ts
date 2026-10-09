import { EmbedBuilder } from "discord.js";
import { escapeText, truncate } from "../../lib/escape";
import { formatDuration } from "./duration";

export type CaseView = {
  caseNumber: number;
  type: "warn" | "timeout" | "untimeout" | "kick" | "ban" | "unban" | "note" | "antibot";
  source: "command" | "dashboard" | "audit_log" | "automod";
  targetId: string;
  targetName: string | null;
  moderatorId: string;
  moderatorName: string | null;
  reason: string | null;
  durationSeconds: number | null;
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
};

const TYPE_STYLE: Record<CaseView["type"], { label: string; color: number }> = {
  warn: { label: "Warning", color: 0xf5b942 },
  timeout: { label: "Timeout", color: 0xe67e22 },
  untimeout: { label: "Timeout removed", color: 0x95a5a6 },
  kick: { label: "Kick", color: 0xe74c3c },
  ban: { label: "Ban", color: 0xc0392b },
  unban: { label: "Unban", color: 0x2ecc71 },
  note: { label: "Note", color: 0x3498db },
  antibot: { label: "Anti-bot", color: 0x9b59b6 },
};

export function typeLabel(type: CaseView["type"]): string {
  return TYPE_STYLE[type].label;
}

const unix = (d: Date) => Math.floor(d.getTime() / 1000);

/**
 * "<@id> (`id`)" — a mention renders the current name; the raw ID stays
 * searchable. Names are a snapshot and user-controlled, so they're escaped.
 */
export function memberLine(id: string, name: string | null): string {
  if (id === "system") return "Automatic rule";
  return `<@${id}> (${name ? `${escapeText(name)}, ` : ""}\`${id}\`)`;
}

/** One embed per case. Embeds never ping, and user text is escaped. */
export function buildCaseEmbed(c: CaseView): EmbedBuilder {
  const style = TYPE_STYLE[c.type];
  const embed = new EmbedBuilder()
    .setColor(style.color)
    .setTitle(`Case #${c.caseNumber} · ${style.label}${c.type === "warn" && !c.active ? " (pardoned)" : ""}`)
    .addFields(
      { name: "Member", value: memberLine(c.targetId, c.targetName) },
      { name: "Moderator", value: memberLine(c.moderatorId, c.moderatorName) },
      { name: "Reason", value: c.reason ? truncate(escapeText(c.reason), 1000) : "*No reason given*" },
    )
    .setTimestamp(c.createdAt);

  if (c.durationSeconds) {
    embed.addFields({
      name: "Duration",
      value: c.expiresAt
        ? `${formatDuration(c.durationSeconds)} (until <t:${unix(c.expiresAt)}:f>)`
        : formatDuration(c.durationSeconds),
      inline: true,
    });
  }
  if (c.source !== "command") {
    const sourceLabel = { dashboard: "Dashboard", audit_log: "Discord (audit log)", automod: "Automatic", command: "Command" }[c.source];
    embed.setFooter({ text: `Source: ${sourceLabel}` });
  }
  return embed;
}
