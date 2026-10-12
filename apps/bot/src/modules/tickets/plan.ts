import { OverwriteType, PermissionFlagsBits as P } from "discord.js";
import {
  MAX_TRANSCRIPT_CONTENT,
  MAX_TRANSCRIPT_MESSAGES,
  type Transcript,
  type TranscriptMessage,
  isDiscordAttachmentUrl,
} from "@aboutselphy/shared/tickets";

// The parts of tickets that need no Discord connection and no database: who may see a ticket,
// who may do what, the control ids, and turning a conversation into a transcript. Pure, so the
// rules are testable.

export type OverwriteSpec = { id: string; type: OverwriteType; allow: bigint[]; deny: bigint[] };

/**
 * The permission overwrites of a new ticket channel: invisible to everyone, readable and writable
 * by the member who opened it and by the staff roles, and fully usable by the bot (it creates,
 * edits and deletes the channel).
 */
export function ticketOverwrites(opts: { everyoneId: string; openerId: string; botId: string; staffRoleIds: string[] }): OverwriteSpec[] {
  const talk = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles, P.EmbedLinks];
  return [
    { id: opts.everyoneId, type: OverwriteType.Role, allow: [], deny: [P.ViewChannel] },
    { id: opts.openerId, type: OverwriteType.Member, allow: talk, deny: [] },
    ...opts.staffRoleIds.map((id) => ({ id, type: OverwriteType.Role, allow: [...talk, P.ManageMessages], deny: [] as bigint[] })),
    { id: opts.botId, type: OverwriteType.Member, allow: [...talk, P.ManageChannels, P.ManageMessages], deny: [] },
  ];
}

export type Who = { isStaff: boolean; isOpener: boolean };

/** The opener or any staff member can close a ticket; only staff can claim it. */
export const canClose = (w: Who) => w.isStaff || w.isOpener;
export const canClaim = (w: Who) => w.isStaff;

// -- control ids: "tk:open", "tk:close:<id>", "tk:confirm:<id>", "tk:claim:<id>" ------------------------

export const TICKET_PREFIX = "tk";
export type TicketControl = { action: "open" } | { action: "modal" } | { action: "close" | "confirm" | "claim"; ticketId: string };

export const ticketControlId = (action: "close" | "confirm" | "claim", ticketId: string) => `${TICKET_PREFIX}:${action}:${ticketId}`;
export const OPEN_CONTROL_ID = `${TICKET_PREFIX}:open`;
/** The form that asks what the ticket is about. */
export const MODAL_CONTROL_ID = `${TICKET_PREFIX}:modal`;
export const REASON_FIELD_ID = "reason";

/** Strict parse: only our own shapes with an id-looking part. */
export function parseTicketControl(customId: string): TicketControl | null {
  if (customId === OPEN_CONTROL_ID) return { action: "open" };
  if (customId === MODAL_CONTROL_ID) return { action: "modal" };
  const match = /^tk:(close|confirm|claim):([a-z0-9]{10,40})$/.exec(customId);
  return match ? { action: match[1] as "close" | "confirm" | "claim", ticketId: match[2]! } : null;
}

// -- the transcript ----------------------------------------------------------------------------------

export type RawMessage = {
  id: string;
  authorId: string;
  authorName: string;
  authorBot: boolean;
  at: Date;
  content: string;
  attachments: Array<{ name: string; url: string }>;
  embeds: number;
};

/**
 * The conversation as stored: oldest first, capped in count and per message, with only Discord CDN
 * links kept as attachments. `total` is how many messages the channel had, so a cut is visible.
 */
export function buildTranscript(messages: RawMessage[], total: number = messages.length): Transcript {
  const sorted = [...messages].sort((a, b) => a.at.getTime() - b.at.getTime());
  const kept = sorted.slice(-MAX_TRANSCRIPT_MESSAGES);
  const out: TranscriptMessage[] = kept.map((m) => ({
    id: m.id,
    authorId: m.authorId,
    authorName: m.authorName.slice(0, 100),
    authorBot: m.authorBot,
    at: m.at.toISOString(),
    content: m.content.slice(0, MAX_TRANSCRIPT_CONTENT),
    attachments: m.attachments.filter((a) => isDiscordAttachmentUrl(a.url)).slice(0, 10).map((a) => ({ name: a.name.slice(0, 120), url: a.url })),
    embeds: m.embeds,
  }));
  return { version: 1, messages: out, truncated: total > out.length };
}

/** The transcript as a plain text file for the log channel. */
export function transcriptToText(transcript: Transcript, header: string): string {
  const lines = [header, "=".repeat(Math.min(80, header.length)), ""];
  for (const m of transcript.messages) {
    const time = m.at.replace("T", " ").slice(0, 19);
    const files = m.attachments.length ? ` [${m.attachments.map((a) => `${a.name}: ${a.url}`).join(", ")}]` : "";
    const embeds = m.embeds ? ` [${m.embeds} embed${m.embeds === 1 ? "" : "s"}]` : "";
    lines.push(`[${time}] ${m.authorName}${m.authorBot ? " (bot)" : ""}: ${m.content}${files}${embeds}`);
  }
  if (transcript.truncated) lines.push("", "(older messages were cut: only the latest are kept)");
  return lines.join("\n");
}

// -- idle tickets ------------------------------------------------------------------------------------

/** The moment before which a ticket counts as idle, or null when automatic closing is off (0 hours). */
export function idleCutoff(hours: number, now: Date): Date | null {
  return Number.isInteger(hours) && hours > 0 ? new Date(now.getTime() - hours * 3_600_000) : null;
}

/** What an opener typed into the form, made safe to store and show: trimmed, one blank line at most, cut to size. */
export function cleanReason(text: string | null | undefined, max = 300): string {
  return (text ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}
