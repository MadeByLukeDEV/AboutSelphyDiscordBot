/**
 * Where the internal API listens. It is meant for the dashboard only, and the
 * bearer secret is its only protection, so it must not be reachable from the
 * local network by accident:
 *  - production (a container): all interfaces, so the dashboard container can
 *    reach it over the Docker network. It is never published to the internet.
 *  - anything else (a developer machine): loopback only.
 * BOT_API_HOST overrides both.
 */
export function resolveApiHost(botEnv: "local" | "production", override?: string): string {
  const explicit = override?.trim();
  if (explicit) return explicit;
  return botEnv === "production" ? "0.0.0.0" : "127.0.0.1";
}
