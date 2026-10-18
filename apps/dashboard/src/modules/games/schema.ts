import type { GameSettings, StatGame } from "@aboutselphy/shared/games";

// Types shared by the service, the actions and the client components. No server-only imports.

export type GamesError = "forbidden" | "invalid" | "botUnavailable" | "channelNotFound" | "failed";
export type SaveGamesResult = { ok: true; settings: GameSettings; botNotified: boolean } | { ok: false; error: GamesError };
export type TopRow = { userId: string; name: string; wins: number; played: number };
export type TopByGame = Record<StatGame, TopRow[]>;
