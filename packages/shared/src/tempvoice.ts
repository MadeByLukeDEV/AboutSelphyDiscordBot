/**
 * How many "join to create" lobbies there can be. A guard against runaway
 * configuration (and against a lobby per channel by accident), the same on the
 * bot and in the dashboard.
 */
export const MAX_TEMP_VOICE_LOBBIES = 10;
