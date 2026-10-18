import "server-only";
import type { GameConfig } from "@aboutselphy/db";
import { STAT_GAMES, type GameSettings } from "@aboutselphy/shared/games";
import { errorInfo } from "@/lib/log";
import { listChannels, reloadBotModule } from "@/modules/bot-api";
import { readConfig, topOf, updateConfig } from "./repository";
import type { SaveGamesResult, TopByGame } from "./schema";

const toSettings = (c: GameConfig): GameSettings => ({
  winXp: c.winXp,
  dailyXpCap: c.dailyXpCap,
  cooldownSeconds: c.cooldownSeconds,
  allowedChannelIds: c.allowedChannelIds,
  triviaOn: c.triviaOn,
  rpsOn: c.rpsOn,
  tictactoeOn: c.tictactoeOn,
  connect4On: c.connect4On,
  funOn: c.funOn,
  wordOn: c.wordOn,
});

/** The settings, the best players of each game, and the channels to pick from (null = the bot can't be reached). */
export async function getGamesPage() {
  const [config, channels, ...tops] = await Promise.all([readConfig(), listChannels(["text", "category"]), ...STAT_GAMES.map((g) => topOf(g))]);
  const top = Object.fromEntries(STAT_GAMES.map((g, i) => [g, tops[i]!.map((r) => ({ userId: r.userId, name: r.name || r.userId, wins: r.wins, played: r.played }))])) as TopByGame;
  return { settings: toSettings(config), channels, top };
}

/** Saves the settings. Channels newly added to the allow-list must exist (checked through the bot; refused if it can't answer). */
export async function saveGames(input: GameSettings): Promise<SaveGamesResult> {
  try {
    const current = await readConfig();
    const added = input.allowedChannelIds.filter((id) => !current.allowedChannelIds.includes(id));
    if (added.length > 0) {
      const channels = await listChannels(["text", "category"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (added.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    const saved = await updateConfig(input);
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("games") };
  } catch (error) {
    console.error("[games] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
