import { OverwriteType, PermissionFlagsBits as P } from "discord.js";

export type OverwriteSpec = { id: string; type: OverwriteType; allow: bigint[]; deny: bigint[] };

/**
 * The permission overwrites a new room starts with.
 *
 * Video ("Stream") and the soundboard are set explicitly to allowed or denied
 * rather than inherited: the toggles then mean what they say even if the
 * category itself says otherwise. The owner gets only what they need to always
 * get back into their own room once it is locked. Everything else (kick, lock,
 * rename...) is done by the bot on their behalf, so the owner never holds
 * channel-management permissions in Discord.
 */
export function initialOverwrites(opts: {
  everyoneId: string;
  ownerId: string;
  allowVideo: boolean;
  allowSoundboard: boolean;
}): OverwriteSpec[] {
  const everyone: OverwriteSpec = { id: opts.everyoneId, type: OverwriteType.Role, allow: [], deny: [] };
  (opts.allowVideo ? everyone.allow : everyone.deny).push(P.Stream);
  (opts.allowSoundboard ? everyone.allow : everyone.deny).push(P.UseSoundboard, P.UseExternalSounds);

  const owner: OverwriteSpec = {
    id: opts.ownerId,
    type: OverwriteType.Member,
    allow: [P.ViewChannel, P.Connect],
    deny: [],
  };
  return [everyone, owner];
}

/** What the bot itself needs to create, move people into and delete rooms. */
export const BOT_ROOM_PERMISSIONS = [
  ["ViewChannel", P.ViewChannel],
  ["ManageChannels", P.ManageChannels],
  ["MoveMembers", P.MoveMembers],
  ["Connect", P.Connect],
] as const;

/** Names of the room permissions the bot lacks, given a "does the bot have this flag" check. */
export function missingBotPermissions(has: (flag: bigint) => boolean): string[] {
  return BOT_ROOM_PERMISSIONS.filter(([, flag]) => !has(flag)).map(([name]) => name);
}
