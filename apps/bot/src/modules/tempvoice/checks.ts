import type { Guild } from "discord.js";
import { missingBotPermissions } from "./permissions";

/**
 * What the bot is missing to run rooms in this category (or next to the lobby).
 * Used when an admin sets things up (the /tempvoice command) and by the
 * dashboard's live view, so a wrong role setup is visible instead of showing up
 * as a silent failure the first time someone joins the lobby.
 */
export async function missingFor(guild: Guild, lobbyId: string | null, categoryId: string | null): Promise<string[]> {
  const me = guild.members.me ?? (await guild.members.fetchMe());
  const target =
    (categoryId ? guild.channels.cache.get(categoryId) : null) ??
    (lobbyId ? (guild.channels.cache.get(lobbyId)?.parent ?? guild.channels.cache.get(lobbyId)) : null);
  const perms = target ? target.permissionsFor(me) : me.permissions;
  return missingBotPermissions((flag) => perms?.has(flag) ?? false);
}
