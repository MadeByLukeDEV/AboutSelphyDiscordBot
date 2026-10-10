import { EmbedBuilder } from "discord.js";
import type { AnyWebhookEvent } from "@aboutselphy/shared/webhooks";
import { escapeText, truncate } from "../../lib/escape";

// The messages the bot makes from webhook data. Everything that came from outside (an external
// service's text, names, a reason typed by a moderator) is escaped and nothing can ping.

const quote = (text: string, max: number) => truncate(text.split("\n").map((line) => escapeText(line)).join("\n"), max);

/** An embed from a message that arrived at an endpoint. The link is only used if it is https. */
export function buildRelayEmbed(m: { source: string; title?: string; content?: string; url?: string; color?: number }) {
  const embed = new EmbedBuilder().setColor(m.color ?? 0x00ffa8).setFooter({ text: `Via ${truncate(escapeText(m.source), 60)}` }).setTimestamp();
  if (m.title) embed.setTitle(truncate(escapeText(m.title), 256));
  if (m.title && m.url && /^https:\/\/[^\s]+$/.test(m.url)) embed.setURL(m.url);
  if (m.content) embed.setDescription(quote(m.content, 4000));
  return { content: "", embeds: [embed], allowedMentions: { parse: [] as never[] } };
}

type CaseData = { caseNumber: number; type: string; targetId: string; targetName: string | null; moderatorName: string | null; reason: string | null; durationSeconds: number | null };
type LiveData = { login: string; displayName: string; title: string; game: string; url: string };

/** The Discord-webhook message for an event, from the raw event data. */
export function describeEvent(event: AnyWebhookEvent, data: unknown): { title: string; description: string; color: number } {
  if (event === "mod.case") {
    const d = data as CaseData;
    const lines = [`**Member:** ${escapeText(d.targetName ?? "unknown")} (\`${d.targetId}\`)`, `**By:** ${escapeText(d.moderatorName ?? "the bot")}`];
    if (d.durationSeconds) lines.push(`**Duration:** ${Math.round(d.durationSeconds / 60)} min`);
    if (d.reason) lines.push(`**Reason:** ${quote(d.reason, 500)}`);
    return { title: `Case #${d.caseNumber} · ${escapeText(d.type)}`, description: lines.join("\n"), color: 0xe74c3c };
  }
  if (event === "twitch.live") {
    const d = data as LiveData;
    return { title: `${escapeText(d.displayName)} is live`, description: [escapeText(d.title), d.game ? `Playing ${escapeText(d.game)}` : "", d.url].filter(Boolean).join("\n"), color: 0x9146ff };
  }
  return { title: "Test event", description: "This is a test message from the AboutSelphy bot.", color: 0x00ffa8 };
}
