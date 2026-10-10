/** AES-GCM additional data for the stored Twitch refresh token: the dashboard writes it, the bot reads it. */
export const TWITCH_REFRESH_TOKEN_PURPOSE = "twitch-bot-refresh-token";

/**
 * EventSub over WebSocket allows a total subscription cost of 10 per connection, and
 * stream.online + stream.offline cost 1 each for a channel that has not authorized our
 * app, so five channels fill it. More needs a second connection or the webhook transport.
 */
export const MAX_TWITCH_STREAMERS = 5;
