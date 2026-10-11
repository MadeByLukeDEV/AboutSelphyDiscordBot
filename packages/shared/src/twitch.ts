/** AES-GCM additional data for the stored Twitch refresh token: the dashboard writes it, the bot reads it. */
export const TWITCH_REFRESH_TOKEN_PURPOSE = "twitch-bot-refresh-token";

/**
 * EventSub over WebSocket allows a total subscription cost of 10 per connection, and
 * stream.online + stream.offline cost 1 each for a channel that has not authorized our
 * app, so five channels get instant events.
 */
export const MAX_TWITCH_EVENTSUB_STREAMERS = 5;

/**
 * Every channel after the first five is checked by polling Helix once a minute instead
 * (one request covers up to 100 channels), so an announcement can be up to a minute late.
 */
export const MAX_TWITCH_STREAMERS = 30;
