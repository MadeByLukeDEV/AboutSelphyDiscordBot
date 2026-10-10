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

const channelOrNone = z.union([snowflake, z.literal("")]);

const nameTemplate = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(visible, "invisible characters");

const base = {
  enabled: z.boolean(),
  /** Empty = none. */
  lobbyChannelId: channelOrNone,
  /** Empty = next to the lobby. */
  categoryId: channelOrNone,
  nameTemplate,
  /** 0 = no limit. */
  defaultUserLimit: z.number().int().min(0).max(99),
  allowVideoByDefault: z.boolean(),
  allowSoundboardByDefault: z.boolean(),
  /** Also refuse the built-in list of common insults and slurs (English and German). */
  useDefaultBlocklist: z.boolean(),
};

const needsLobby = (v: { enabled: boolean; lobbyChannelId: string }) => !v.enabled || v.lobbyChannelId !== "";
const needsLobbyIssue = { message: "needsLobby", path: ["enabled"] };

/** What the server action accepts (the blocked words already split into a list). */
export const settingsSchema = z
  .object({
    ...base,
    blockedWords: z
      .array(z.string().trim().min(1).max(MAX_BLOCKED_WORD_LENGTH).refine(visible, "invisible characters"))
      .max(MAX_BLOCKED_WORDS),
  })
  .refine(needsLobby, needsLobbyIssue);
export type SettingsInput = z.infer<typeof settingsSchema>;

/** What the form edits: the blocked words as one block of text. */
export const settingsFormSchema = z
  .object({ ...base, blockedWordsText: z.string().max(3000) })
  .refine(needsLobby, needsLobbyIssue);
export type SettingsFormValues = z.infer<typeof settingsFormSchema>;

export function toFormValues(s: SettingsInput): SettingsFormValues {
  const { blockedWords, ...rest } = s;
  return { ...rest, blockedWordsText: blockedWords.join("\n") };
}

export function fromFormValues(v: SettingsFormValues): SettingsInput {
  const { blockedWordsText, ...rest } = v;
  return { ...rest, blockedWords: parseBlockedWords(blockedWordsText) };
}

/**
 * True when the room name template itself contains something the settings would
 * block (the admin's own words, or the built-in list if it is on). {user} is
 * left out: it is replaced by the owner's name later.
 */
export function isTemplateBlocked(s: Pick<SettingsInput, "nameTemplate" | "blockedWords" | "useDefaultBlocklist">): boolean {
  const text = s.nameTemplate.replaceAll("{user}", " ");
  return findBlockedWord(text, s.blockedWords) !== null || (s.useDefaultBlocklist && findProfanity(text) !== null);
}

export type SettingsError =
  | "forbidden"
  | "invalid"
  | "templateBlocked"
  | "needsLobby"
  | "botUnavailable"
  | "lobbyNotFound"
  | "categoryNotFound"
  | "failed";

export type SaveSettingsResult =
  | { ok: true; settings: SettingsInput; botNotified: boolean }
  | { ok: false; error: SettingsError };
