import { env } from "./env";
import { log } from "./log";

// A tiny client for any OpenAI-compatible chat API (Groq, Gemini's compatibility endpoint, OpenRouter ...), configured by the operator with
// AI_BASE_URL, AI_API_KEY and AI_MODEL. Optional: without them every feature that could use it simply doesn't. The address comes from the
// environment (never from a user), the key is only ever sent as a bearer header and never logged, and a failure is a short code, not the response.

export const aiConfigured = (): boolean => Boolean(env().AI_API_KEY && env().AI_BASE_URL && env().AI_MODEL);

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;

/** Is this answer worth trying again? Providers answer 503 or 429 for a moment when they are overloaded. */
export const shouldRetry = (status: number): boolean => RETRY_STATUSES.has(status);

/** How long to wait before the next try: the provider's Retry-After (at most 30 s), else 4 s then 12 s. */
export function retryDelayMs(attempt: number, retryAfter: string | null): number {
  const asked = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(asked) && asked >= 0) return Math.min(asked, 30) * 1000;
  return attempt === 1 ? 4000 : 12_000;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Asks the model for a JSON object. Returns the parsed JSON, or null on any failure (timeout, quota, bad answer). A busy provider is retried twice. */
export async function chatJson(system: string, user: string, opts: { maxTokens?: number; timeoutMs?: number } = {}): Promise<unknown | null> {
  const { AI_API_KEY, AI_BASE_URL, AI_MODEL, AI_REASONING_EFFORT } = env();
  if (!AI_API_KEY || !AI_BASE_URL || !AI_MODEL) return null;
  const body = JSON.stringify({
    model: AI_MODEL,
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 1500,
    ...(AI_REASONING_EFFORT ? { reasoning_effort: AI_REASONING_EFFORT } : {}),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(`${AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${AI_API_KEY}` },
        body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
      if (!res.ok) {
        const again = shouldRetry(res.status) && attempt < MAX_ATTEMPTS;
        log.warn({ status: res.status, attempt, willRetry: again }, "ai: the provider refused the request");
        if (!again) return null;
        await sleep(retryDelayMs(attempt, res.headers.get("retry-after")));
        continue;
      }
      const answer = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
      const content = answer?.choices?.[0]?.message?.content;
      if (typeof content !== "string") return null;
      // Some models wrap JSON in a code fence even when asked not to.
      const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      return JSON.parse(text) as unknown;
    }
    return null;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.name : "error" }, "ai: the request failed");
    return null;
  }
}
