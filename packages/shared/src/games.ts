import { z } from "zod";

// The minigames' settings and constants. One definition for the dashboard and the bot. Pure.
// Import it from "@aboutselphy/shared/games" in client components.

export const GAME_KEYS = ["trivia", "rps", "tictactoe", "connect4", "fun"] as const;
export type GameKey = (typeof GAME_KEYS)[number];
/** What the stats are kept under: the four real games (the instant "fun" commands keep no record). */
export const STAT_GAMES = ["trivia", "rps", "tictactoe", "connect4"] as const;
export type StatGame = (typeof STAT_GAMES)[number];
export const isStatGame = (v: unknown): v is StatGame => STAT_GAMES.includes(v as StatGame);

export const MAX_GAME_CHANNELS = 20;

const snowflake = z.string().regex(/^\d{17,20}$/);

export const gameSettingsSchema = z.object({
  winXp: z.number().int().min(0).max(100),
  dailyXpCap: z.number().int().min(0).max(5000),
  cooldownSeconds: z.number().int().min(0).max(600),
  allowedChannelIds: z
    .array(snowflake)
    .max(MAX_GAME_CHANNELS)
    .refine((ids) => new Set(ids).size === ids.length, "duplicate"),
  triviaOn: z.boolean(),
  rpsOn: z.boolean(),
  tictactoeOn: z.boolean(),
  connect4On: z.boolean(),
  funOn: z.boolean(),
});
export type GameSettings = z.infer<typeof gameSettingsSchema>;
