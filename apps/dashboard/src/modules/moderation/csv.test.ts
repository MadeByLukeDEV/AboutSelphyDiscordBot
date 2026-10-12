import { describe, expect, it } from "vitest";
import { casesToCsv, csvCell, type ExportCase } from "./csv";

describe("csvCell", () => {
  it("leaves plain text alone and writes empty for nothing", () => {
    expect(csvCell("hello")).toBe("hello");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(12)).toBe("12");
    expect(csvCell(true)).toBe("true");
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("one\ntwo")).toBe('"one\ntwo"');
  });
  it("defuses anything a spreadsheet would run as a formula", () => {
    for (const evil of ["=SUM(A1)", "+1", "-2", "@cmd", "\tx", "\rx"]) expect(csvCell(evil).replace(/^"/, "").startsWith("'"), evil).toBe(true);
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
  });
  it("does not touch a negative number (a number, not text)", () => {
    expect(csvCell(-5)).toBe("-5");
  });
});

describe("casesToCsv", () => {
  const row: ExportCase = { caseNumber: 7, type: "warn", source: "command", targetId: "111111111111111111", targetName: "Sam, Jr.", moderatorId: "222222222222222222", moderatorName: "Mod", reason: "spam\n=bad", createdAt: new Date("2026-10-01T10:00:00Z"), expiresAt: null, active: true, reasonEditedByName: null };
  it("writes a header and one safe line per case", () => {
    const lines = casesToCsv([row]).split("\r\n");
    expect(lines[0]).toBe("case,type,source,member_id,member_name,moderator,reason,created_at,expires_at,active,reason_edited_by");
    expect(lines[1]).toBe('7,warn,command,111111111111111111,"Sam, Jr.",Mod,"spam\n=bad",2026-10-01T10:00:00.000Z,,true,');
  });
  it("names automatic cases", () => {
    expect(casesToCsv([{ ...row, moderatorId: "system", moderatorName: null }])).toContain(",automatic,");
  });
  it("is just a header with no cases", () => {
    expect(casesToCsv([])).toBe("case,type,source,member_id,member_name,moderator,reason,created_at,expires_at,active,reason_edited_by\r\n");
  });
});
