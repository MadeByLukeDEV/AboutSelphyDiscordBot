// The counting channel's rules. Pure, so they are testable.

/** The number a message starts with ("12", "12 nice"), or null. Digits only, up to 9 of them; "12abc", "1.5" and "-3" don't count. */
export function parseCount(content: string): number | null {
  const normalized = content.normalize("NFKC").replace(/[\u200b-\u200f\u2060\ufeff]/g, "").trim();
  const match = /^(\d{1,9})(?=\s|$)/.exec(normalized);
  return match ? Number(match[1]) : null;
}

export type Verdict = "ok" | "wrong" | "same-user";

/** Is this the next number, from someone allowed to count it? */
export function judge(input: { current: number; number: number; userId: string; lastUserId: string | null; allowConsecutive: boolean }): Verdict {
  if (!input.allowConsecutive && input.lastUserId !== null && input.lastUserId === input.userId) return "same-user";
  return input.number === input.current + 1 ? "ok" : "wrong";
}

export function mistakeMessage(userId: string, current: number, reset: boolean): string {
  return reset ? `<@${userId}> ruined it at **${current}**! The next number is **1**.` : `<@${userId}> that's not the next number. The next number is **${current + 1}**.`;
}
