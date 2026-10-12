import "server-only";
import type { SuggestionConfig } from "@aboutselphy/db";
import { MAX_NOTES_PER_SUGGESTION, SUGGESTION_STATUSES, type DecisionInput, type SuggestionSettings, type SuggestionStatusName } from "@aboutselphy/shared/suggestions";
import { errorInfo } from "@/lib/log";
import { decideSuggestionViaBot, listChannels, mergeSuggestionViaBot, reloadBotModule } from "@/modules/bot-api";
import { addNote, countByStatus, countNotes, deleteNote, listSuggestions, notesOf, readConfig, suggestionExists, updateConfig } from "./repository";
import type { DecideResult, NoteResult, SaveSuggestionsResult, SuggestionNote, SuggestionRow } from "./schema";

const toSettings = (c: SuggestionConfig): SuggestionSettings => ({ enabled: c.enabled, channelId: c.channelId ?? "", cooldownSeconds: c.cooldownSeconds });

const toNote = (n: { id: string; authorName: string; body: string; createdAt: Date }): SuggestionNote => ({ id: n.id, authorName: n.authorName, body: n.body, createdAt: n.createdAt.toISOString() });

const parseFilter = (value: string | undefined): SuggestionStatusName | null => SUGGESTION_STATUSES.find((s) => s === value) ?? null;

/** Settings, the suggestions (optionally of one status), counts per status, and the channels to pick from (null = bot unreachable). */
export async function getSuggestionsPage(statusParam: string | undefined) {
  const status = parseFilter(statusParam);
  const [config, rows, counts, channels] = await Promise.all([readConfig(), listSuggestions(status, 50), countByStatus(), listChannels(["text"])]);
  const suggestions: SuggestionRow[] = rows.map((s) => ({
    id: s.id,
    number: s.number,
    authorId: s.authorId,
    authorName: s.authorName,
    content: s.content,
    status: s.status,
    up: s.up,
    down: s.down,
    decidedByName: s.decidedByName,
    decisionReason: s.decisionReason,
    createdAt: s.createdAt.toISOString(),
    mergedInto: s.mergedIntoNumber,
    notes: s.comments.map(toNote),
  }));
  const perStatus = Object.fromEntries(SUGGESTION_STATUSES.map((st) => [st, counts.find((c) => c.status === st)?._count._all ?? 0])) as Record<SuggestionStatusName, number>;
  return { settings: toSettings(config), suggestions, perStatus, filter: status, channels };
}

/** Saves the settings. A new channel must be a text channel of the server (checked through the bot; refused if it can't answer). */
export async function saveSuggestions(input: SuggestionSettings): Promise<SaveSuggestionsResult> {
  try {
    const current = await readConfig();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    const saved = await updateConfig({ enabled: input.enabled, channelId: input.channelId || null, cooldownSeconds: input.cooldownSeconds });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("suggestions") };
  } catch (error) {
    console.error("[suggestions] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** The decision is carried out by the bot (it updates the post and tells the author); `by` is only a label. */
export async function decide(input: DecisionInput, byName: string): Promise<DecideResult> {
  const status = await decideSuggestionViaBot({ id: input.id, status: input.status, reason: input.reason, by: byName.slice(0, 100) || "the team" });
  if (status === "done") return { ok: true };
  if (status === null) return { ok: false, error: "botUnavailable" };
  return { ok: false, error: status === "not-found" ? "notFound" : status === "wrong-state" ? "wrongState" : "failed" };
}

/** Adds a private team note (never shown to members). At most 50 per suggestion. */
export async function addSuggestionNote(suggestionId: string, body: string, byName: string): Promise<NoteResult> {
  try {
    if (!(await suggestionExists(suggestionId))) return { ok: false, error: "notFound" };
    if ((await countNotes(suggestionId)) >= MAX_NOTES_PER_SUGGESTION) return { ok: false, error: "tooManyNotes" };
    await addNote(suggestionId, byName || "the team", body);
    return { ok: true, notes: (await notesOf(suggestionId)).map(toNote) };
  } catch (error) {
    console.error("[suggestions] adding a note failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeSuggestionNote(noteId: string): Promise<NoteResult> {
  try {
    const suggestionId = await deleteNote(noteId);
    if (!suggestionId) return { ok: false, error: "notFound" };
    return { ok: true, notes: (await notesOf(suggestionId)).map(toNote) };
  } catch (error) {
    console.error("[suggestions] removing a note failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Closes a suggestion as a duplicate of another (the bot moves the votes and edits both posts). */
export async function mergeSuggestion(id: string, targetNumber: number, byName: string): Promise<DecideResult> {
  const status = await mergeSuggestionViaBot({ id, targetNumber, by: byName.slice(0, 100) || "the team" });
  if (status === "done") return { ok: true };
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "not-found") return { ok: false, error: "notFound" };
  if (status === "target-not-found") return { ok: false, error: "targetNotFound" };
  if (status === "same") return { ok: false, error: "same" };
  return { ok: false, error: status === "wrong-state" ? "wrongState" : "failed" };
}
