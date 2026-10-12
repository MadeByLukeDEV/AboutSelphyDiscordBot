// Pure parts of the audit trail (no database, so they are unit-tested).

/** Did the action report success? The actions return { ok: true, ... } or { ok: false, error }. */
export function wasSuccessful(result: unknown): boolean {
  return typeof result === "object" && result !== null && "ok" in result && (result as { ok: unknown }).ok === true;
}

/** The thing an action was about, if its first argument is a short id or number; anything bigger (a form, an object) is not stored. */
export function auditTarget(first: unknown): string {
  if (typeof first === "number" && Number.isFinite(first)) return String(first).slice(0, 64);
  if (typeof first === "string" && /^[\w:.-]{1,64}$/.test(first)) return first;
  return "";
}

/** "saveStreamer" -> ["save", "Streamer"]: the verb (translated on the page) and the rest. */
export function splitAction(action: string): { verb: string; rest: string } {
  const m = /^([a-z]+)(.*)$/.exec(action);
  return { verb: m?.[1] ?? action, rest: (m?.[2] ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").trim() };
}

export const AUDIT_KEEP_DAYS = 365;
