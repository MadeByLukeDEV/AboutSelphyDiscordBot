export type TransitionInput = {
  /** The voice channel the member was in, or null if they weren't connected. */
  oldChannelId: string | null;
  /** The voice channel they are in now, or null if they disconnected. */
  newChannelId: string | null;
  enabled: boolean;
  lobbyChannelId: string | null;
  /** Whether a channel is one of our rooms. */
  isRoom: (channelId: string) => boolean;
};

export type TransitionPlan = {
  /** Give this member a room (they joined the lobby). */
  createRoom: boolean;
  /** A room they left that may now be empty. */
  checkEmpty: string | null;
};

/**
 * What a voice-state change means for temporary rooms. Pure, so every case is
 * tested. Two rules matter:
 *  - a change inside the same channel (mute, deafen, camera on...) does nothing
 *  - rooms are cleaned up even while the feature is switched off, otherwise
 *    disabling it would strand empty rooms
 */
export function planTransition(i: TransitionInput): TransitionPlan {
  if (i.oldChannelId === i.newChannelId) return { createRoom: false, checkEmpty: null };

  return {
    createRoom: i.enabled && i.lobbyChannelId !== null && i.newChannelId === i.lobbyChannelId,
    checkEmpty: i.oldChannelId !== null && i.isRoom(i.oldChannelId) ? i.oldChannelId : null,
  };
}
