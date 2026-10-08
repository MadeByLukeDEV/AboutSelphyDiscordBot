import pino from "pino";

/**
 * Plain JSON logs to stdout (Dokploy collects them). The bot token is
 * redacted defensively in case an object containing it is ever logged.
 */
export const log = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: ["token", "*.token", "authorization", "*.authorization", "DISCORD_BOT_TOKEN"],
  base: { app: "bot" },
});
