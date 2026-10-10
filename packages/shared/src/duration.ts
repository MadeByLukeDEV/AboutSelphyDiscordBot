const UNIT_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
  w: 604_800,
};

/** Discord's hard limit for a member timeout. */
export const MAX_TIMEOUT_SECONDS = 28 * 86_400;
export const MIN_TIMEOUT_SECONDS = 60;

/**
 * "10m", "2h", "7d", "1d12h", "1w" -> seconds. Returns null for anything
 * else (empty, unknown unit, zero, absurdly long numbers).
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!/^(\d{1,7}[smhdw])+$/.test(text)) return null;

  let total = 0;
  for (const [, amount, unit] of text.matchAll(/(\d+)([smhdw])/g)) {
    total += Number(amount) * UNIT_SECONDS[unit!]!;
  }
  return total > 0 ? total : null;
}

/** 129900 -> "1d 12h 5m". Seconds are only shown when nothing bigger is. */
export function formatDuration(totalSeconds: number): string {
  let rest = Math.max(0, Math.floor(totalSeconds));
  const parts: string[] = [];
  for (const [unit, size] of [["w", 604_800], ["d", 86_400], ["h", 3600], ["m", 60]] as const) {
    const n = Math.floor(rest / size);
    if (n > 0) parts.push(`${n}${unit}`);
    rest -= n * size;
  }
  if (rest > 0 && parts.length === 0) parts.push(`${rest}s`);
  return parts.join(" ") || "0s";
}
