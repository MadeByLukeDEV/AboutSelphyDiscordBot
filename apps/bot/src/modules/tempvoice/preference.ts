import { isBlocked, sanitizeRoomName, type BlockPolicy } from "./name";

// "Remember my room": what a member's next room starts with, given what their last one looked like and what the
// lobby offers. Pure, so the rules are tested. A remembered value never gets past the same checks a new value would:
// the name is checked against the blocklist again (the list may have grown), the limit stays inside Discord's range,
// and a lobby that switches video or soundboard off for everyone keeps them off.

export type Preference = { name: string; userLimit: number; locked: boolean; videoAllowed: boolean; soundboardAllowed: boolean };
export type LobbyDefaults = { name: string; userLimit: number; allowVideo: boolean; allowSoundboard: boolean };
export type RoomStart = { name: string; userLimit: number; locked: boolean; allowVideo: boolean; allowSoundboard: boolean };

export const MAX_ROOM_LIMIT = 99;

export function startOfRoom(lobby: LobbyDefaults, preference: Preference | null, policy: BlockPolicy): RoomStart {
  if (!preference) return { name: lobby.name, userLimit: lobby.userLimit, locked: false, allowVideo: lobby.allowVideo, allowSoundboard: lobby.allowSoundboard };
  const name = sanitizeRoomName(preference.name);
  const limit = Number.isInteger(preference.userLimit) ? Math.min(MAX_ROOM_LIMIT, Math.max(0, preference.userLimit)) : lobby.userLimit;
  return {
    name: name && !isBlocked(name, policy) ? name : lobby.name,
    userLimit: limit,
    locked: preference.locked,
    allowVideo: lobby.allowVideo && preference.videoAllowed,
    allowSoundboard: lobby.allowSoundboard && preference.soundboardAllowed,
  };
}
