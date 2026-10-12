import type { ModCase } from "@aboutselphy/db";

// Case export as CSV. Pure (no database), so it is unit-tested. Two things matter here: a cell that holds a comma, a
// quote or a line break must be quoted, and a cell that a spreadsheet would run as a formula (it starts with = + - @ or a
// tab or carriage return) must be defused, because reasons and names are typed by members and staff.

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export const CSV_HEADER = ["case", "type", "source", "member_id", "member_name", "moderator", "reason", "created_at", "expires_at", "active", "reason_edited_by"] as const;

export type ExportCase = Pick<ModCase, "caseNumber" | "type" | "source" | "targetId" | "targetName" | "moderatorId" | "moderatorName" | "reason" | "createdAt" | "expiresAt" | "active" | "reasonEditedByName">;

/** The whole file: a header, then one line per case. */
export function casesToCsv(rows: readonly ExportCase[]): string {
  const lines = rows.map((c) =>
    [c.caseNumber, c.type, c.source, c.targetId, c.targetName, c.moderatorId === "system" ? "automatic" : (c.moderatorName ?? c.moderatorId), c.reason, c.createdAt.toISOString(), c.expiresAt?.toISOString() ?? "", c.active, c.reasonEditedByName ?? ""].map(csvCell).join(","),
  );
  return [CSV_HEADER.join(","), ...lines].join("\r\n") + "\r\n";
}
