import { z } from "zod";
import { findBlockedWord, findProfanity, snowflake } from "@aboutselphy/shared";

/** No control or zero-width characters: they make names that look empty or look like something else. */
const visible = (text: string) => !/[\p{Cc}\p{Cf}]/u.test(text);

export const MAX_BLOCKED_WORDS = 50;
export const MAX_BLOCKED_WORD_LENGTH = 50;

/**
 * "one per line or separated by commas" -> a clean list: trimmed, inner spaces
 * collapsed, case-insensitive duplicates dropped, empty entries dropped.
 */
export function parseBlockedWords(text: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const raw of text.split(/[\n,]+/)) {
    const word = raw.trim().replace(/\s+/g, " ");
    const key = word.toLowerCase();
    if (!word || seen.has(key)) continue;
    seen.add(key);
    words.push(word);
  }
  return words;
}

// -- settings every lobby shares ------------------------------------------------------

const globalBase = {
  /** The master switch. */
  enabled: z.boolean(),
  /** Also refuse the built-in list of common insults and slurs (English and German). */
  useDefaultBlocklist: z.boolean(),
};

/** What the server action accepts (the blocked words already split into a list). */
export const globalSettingsSchema = z.object({
  ...globalBase,
  blockedWords: z
    .array(z.string().trim().min(1).max(MAX_BLOCKED_WORD_LENGTH).refine(visible, "invisible characters"))
    .max(MAX_BLOCKED_WORDS),
});
export type GlobalSettings = z.infer<typeof globalSettingsSchema>;

/** What the form edits: the blocked words as one block of text. */
export const globalFormSchema = z.object({ ...globalBase, blockedWordsText: z.string().max(3000) });
export type GlobalFormValues = z.infer<typeof globalFormSchema>;

export const globalToForm = ({ blockedWords, ...rest }: GlobalSettings): GlobalFormValues => ({
  ...rest,
  blockedWordsText: blockedWords.join("\n"),
});

export const globalFromForm = ({ blockedWordsText, ...rest }: GlobalFormValues): GlobalSettings => ({
  ...rest,
  blockedWords: parseBlockedWords(blockedWordsText),
});

// -- one lobby ----------------------------------------------------------------------------

const channelOrNone = z.union([snowflake, z.literal("")]);

const nameTemplate = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(visible, "invisible characters");

const lobbyFields = {
  /** Empty = next to the lobby. */
  categoryId: channelOrNone,
  nameTemplate,
  /** 0 = no limit. */
  defaultUserLimit: z.number().int().min(0).max(99),
  allowVideoByDefault: z.boolean(),
  allowSoundboardByDefault: z.boolean(),
  /** Pause just this lobby. */
  enabled: z.boolean(),
};

/**
 * Create (no id) or update (with the lobby's id). The channel is fixed once a
 * lobby exists: to move a lobby to another channel, remove it and add a new one.
 */
export const lobbySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  channelId: snowflake,
  ...lobbyFields,
});
export type LobbyInput = z.infer<typeof lobbySchema>;

/** The same fields as the form edits them (no id: the dialog knows which lobby it edits). */
export const lobbyFormSchema = z.object({ channelId: channelOrNone, ...lobbyFields });
export type LobbyFormValues = z.infer<typeof lobbyFormSchema>;

export const DEFAULT_LOBBY_FORM: LobbyFormValues = {
  channelId: "",
  categoryId: "",
  nameTemplate: "{user}'s room",
  defaultUserLimit: 0,
  allowVideoByDefault: true,
  allowSoundboardByDefault: true,
  enabled: true,
};

/** A lobby as the dashboard shows it. */
export type LobbyView = LobbyFormValues & { id: string; channelId: string };

/**
 * True when a room name template contains something the settings would block
 * (the admin's own words, or the built-in list if it is on). {user} is left
 * out: it is replaced by the owner's name later.
 */
export function isTemplateBlocked(
  nameTemplate: string,
  policy: { blockedWords: readonly string[]; useDefaultBlocklist: boolean },
): boolean {
  const text = nameTemplate.replaceAll("{user}", " ");
  return findBlockedWord(text, policy.blockedWords) !== null || (policy.useDefaultBlocklist && findProfanity(text) !== null);
}

// -- results ----------------------------------------------------------------------------------

export type SettingsError =
  | "forbidden"
  | "invalid"
  | "templateBlocked"
  | "needsLobby"
  | "botUnavailable"
  | "lobbyNotFound"
  | "categoryNotFound"
  | "alreadyALobby"
  | "tooManyLobbies"
  | "notFound"
  | "failed";

export type SaveGlobalResult = { ok: true; settings: GlobalSettings; botNotified: boolean } | { ok: false; error: SettingsError };
export type SaveLobbyResult = { ok: true; lobby: LobbyView; botNotified: boolean } | { ok: false; error: SettingsError };
export type DeleteLobbyResult = { ok: true; botNotified: boolean } | { ok: false; error: SettingsError };
