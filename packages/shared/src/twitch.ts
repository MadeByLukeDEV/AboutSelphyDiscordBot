/** AES-GCM additional data for the stored Twitch refresh token: the dashboard writes it, the bot reads it. */
export const TWITCH_REFRESH_TOKEN_PURPOSE = "twitch-bot-refresh-token";

/**
 * EventSub over WebSocket allows a total subscription cost of 10 per connection, and
 * stream.online + stream.offline cost 1 each for a channel that has not authorized our
 * app, so five channels (the ones marked "use websocket") get instant events.
 */
export const MAX_TWITCH_EVENTSUB_STREAMERS = 5;

/**
 * Every enabled channel is checked by polling Helix once a minute (one request covers up to 100
 * channels): channels without the websocket depend on it, the others use it as a safety net.
 */
export const MAX_TWITCH_STREAMERS = 100;
