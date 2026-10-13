import { env } from "./env";
import { log } from "./log";

// A tiny client for any OpenAI-compatible chat API (Groq, Gemini's compatibility endpoint, OpenRouter ...), configured by the operator with
// AI_BASE_URL, AI_API_KEY and AI_MODEL. Optional: without them every feature that could use it simply doesn't. The address comes from the
// environment (never from a user), the key is only ever sent as a bearer header and never logged, and a failure is a short code, not the response.

export const aiConfigured = (): boolean => Boolean(env().AI_API_KEY && env().AI_BASE_URL && env().AI_MODEL);

/** Asks the model for a JSON object. Returns the parsed JSON, or null on any failure (timeout, quota, bad answer). */
export async function chatJson(system: string, user: string, opts: { maxTokens?: number; timeoutMs?: number } = {}): Promise<unknown | null> {
  const { AI_API_KEY, AI_BASE_URL, AI_MODEL } = env();
  if (!AI_API_KEY || !AI_BASE_URL || !AI_MODEL) return null;
  try {
    const res = await fetch(`${AI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${AI_API_KEY}` },
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.2,
        max_tokens: opts.maxTokens ?? 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    });
    if (!res.ok) {
      log.warn({ status: res.status }, "ai: the provider refused the request");
      return null;
    }
    const body = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    const content = body?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    // Some models wrap JSON in a code fence even when asked not to.
    const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(text) as unknown;
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.name : "error" }, "ai: the request failed");
    return null;
  }
}
