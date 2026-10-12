import { MAX_LEVEL, totalXpForLevel } from "./levels";

// Importing XP from another bot (MEE6 and friends). The admin pastes either the JSON of a leaderboard
// ({"players":[{"id":"...","username":"...","xp":1234}]}, also a bare array of those) or lines of
// "id xp [name]" separated by space, comma, semicolon or tab. Pure: parsing only, nothing is written here.

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_CHARS = 600_000;
const MAX_XP = totalXpForLevel(MAX_LEVEL);

export type ImportRow = { userId: string; xp: number; name: string };

const ID = /^\d{17,20}$/;

function accept(rows: Map<string, ImportRow>, id: unknown, xp: unknown, name: unknown): boolean {
  const userId = typeof id === "number" ? String(id) : typeof id === "string" ? id.trim() : "";
  const amount = typeof xp === "string" && /^\d+$/.test(xp.trim()) ? Number(xp) : xp;
  if (!ID.test(userId) || typeof amount !== "number" || !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_XP) return false;
  const label = typeof name === "string" ? name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 100) : "";
  const existing = rows.get(userId);
  // The same member twice: the larger total wins.
  if (!existing || amount > existing.xp) rows.set(userId, { userId, xp: amount, name: label || existing?.name || "" });
  return true;
}

/** Reads the pasted text. `skipped` counts entries that were unusable (bad id, bad XP) or over the row limit. */
export function parseXpImport(text: string): { rows: ImportRow[]; skipped: number } {
  const rows = new Map<string, ImportRow>();
  let skipped = 0;
  const trimmed = text.slice(0, MAX_IMPORT_CHARS).trim();
  if (trimmed === "") return { rows: [], skipped: 0 };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch {
      return { rows: [], skipped: 1 };
    }
    const list = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as { players?: unknown }).players) ? (data as { players: unknown[] }).players : null;
    if (!list) return { rows: [], skipped: 1 };
    for (const item of list) {
      const o = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      if (!accept(rows, o.id, o.xp, o.username ?? o.name)) skipped++;
    }
  } else {
    for (const line of trimmed.split(/\r?\n/)) {
      if (line.trim() === "") continue;
      const m = /^\s*(\d+)\s*[\s,;\t]\s*(\d+)(?:\s*[\s,;\t]\s*(.*))?$/.exec(line);
      if (!m || !accept(rows, m[1], m[2], m[3])) skipped++;
    }
  }
  const all = [...rows.values()];
  if (all.length > MAX_IMPORT_ROWS) {
    skipped += all.length - MAX_IMPORT_ROWS;
    return { rows: all.slice(0, MAX_IMPORT_ROWS), skipped };
  }
  return { rows: all, skipped };
}
