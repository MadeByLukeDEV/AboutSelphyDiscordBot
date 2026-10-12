import type { Client } from "discord.js";
import { log } from "./log";

// Logging in to Discord with a retry. Discord or the network being unreachable for a moment (a restart of the host, a
// slow DNS) should not make the bot give up and exit; a wrong token or an intent that is not enabled can never
// succeed, so those fail at once with the real reason.

const PERMANENT = new Set(["TokenInvalid", "TokenMissing", "DisallowedIntents", "InvalidIntents"]);

/** Whether retrying can't help (bad token, intents not enabled in the Developer Portal). */
export function isPermanentLoginError(err: unknown): boolean {
  const code = typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : "";
  return PERMANENT.has(code);
}

/** 1 s, 2 s, 4 s ... capped at 60 s. */
export const backoffMs = (attempt: number): number => Math.min(60_000, 1_000 * 2 ** Math.max(0, attempt));

export const MAX_LOGIN_ATTEMPTS = 8;

export async function loginWithRetry(client: Client, token: string, sleep: (ms: number) => Promise<unknown> = (ms) => new Promise((r) => setTimeout(r, ms))): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await client.login(token);
      return;
    } catch (err) {
      if (isPermanentLoginError(err) || attempt + 1 >= MAX_LOGIN_ATTEMPTS) throw err;
      const wait = backoffMs(attempt);
      log.warn({ attempt: attempt + 1, retryInMs: wait, err: err instanceof Error ? err.message : "unknown" }, "discord login failed, retrying");
      await sleep(wait);
    }
  }
}
