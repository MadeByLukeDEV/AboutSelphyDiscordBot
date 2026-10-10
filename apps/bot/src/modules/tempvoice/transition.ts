export type TransitionInput = {
  /** The voice channel the member was in, or null if they weren't connected. */
  oldChannelId: string | null;
  /** The voice channel they are in now, or null if they disconnected. */
  newChannelId: string | null;
  /** The master switch. */
  enabled: boolean;
  /** The lobbies that are switched on. */
  lobbyChannelIds: ReadonlySet<string>;
  /** Whether a channel is one of our rooms. */
  isRoom: (channelId: string) => boolean;
};

export type TransitionPlan = {
  /** The lobby the member just joined: give them a room made from it. Null = none. */
  createFromLobby: string | null;
  /** A room they left that may now be empty. */
  checkEmpty: string | null;
};

/**
 * What a voice-state change means for temporary rooms. Pure, so every case is
 * tested. Rules that matter:
 *  - a change inside the same channel (mute, deafen, camera on...) does nothing
 *  - a room is only created from a lobby that is switched on, while the master
 *    switch is on
 *  - rooms are cleaned up even while the feature is off, otherwise disabling it
 *    would strand empty rooms
 */
export function planTransition(i: TransitionInput): TransitionPlan {
  if (i.oldChannelId === i.newChannelId) return { createFromLobby: null, checkEmpty: null };

  return {
    createFromLobby: i.enabled && i.newChannelId !== null && i.lobbyChannelIds.has(i.newChannelId) ? i.newChannelId : null,
    checkEmpty: i.oldChannelId !== null && i.isRoom(i.oldChannelId) ? i.oldChannelId : null,
  };
}
