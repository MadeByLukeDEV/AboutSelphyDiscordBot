import { describe, expect, it } from "vitest";
import { caseQueryString, caseWhere } from "./case-filter";
import { caseNumberSchema, caseQuerySchema, settingsSchema } from "./schema";

describe("caseQuerySchema (the cases page's address-bar query)", () => {
  it("accepts valid values", () => {
    expect(caseQuerySchema.parse({ type: "ban", q: "  spam  ", page: "3" })).toEqual({ type: "ban", q: "spam", page: 3 });
  });

  it("falls back instead of throwing on garbage", () => {
    expect(caseQuerySchema.parse({ type: "nonsense", q: "x".repeat(500), page: "-4" })).toEqual({
      type: undefined,
      q: undefined,
      page: 1,
    });
    expect(caseQuerySchema.parse({ page: "abc" }).page).toBe(1);
    expect(caseQuerySchema.parse({}).page).toBe(1);
  });

  it("treats an empty search as no search", () => {
    expect(caseQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });
});

describe("caseWhere", () => {
  it("has no filter by default", () => {
    expect(caseWhere({})).toEqual({});
  });

  it("filters by type", () => {
    expect(caseWhere({ type: "timeout" })).toEqual({ type: "timeout" });
  });

  it("treats a short number as a case number", () => {
    expect(caseWhere({ q: "42" })).toEqual({ OR: [{ caseNumber: 42 }] });
  });

  it("treats a long number as a Discord ID for the member or the moderator", () => {
    const id = "123456789012345678";
    expect(caseWhere({ q: id })).toEqual({ OR: [{ targetId: id }, { moderatorId: id }] });
  });

  it("searches names and reason as text otherwise, case-insensitively", () => {
    const where = caseWhere({ q: "Spam" });
    expect(where.OR).toHaveLength(3);
    expect(JSON.stringify(where)).toContain('"mode":"insensitive"');
  });

  it("falls back to text for digit strings that are neither a case number nor an ID", () => {
    // 12 digits: too long for a case number, too short for a Discord ID.
    expect(caseWhere({ q: "123456789012" }).OR).toHaveLength(3);
  });

  it("combines type and search", () => {
    expect(caseWhere({ type: "warn", q: "7" })).toEqual({ type: "warn", OR: [{ caseNumber: 7 }] });
  });

  it("passes SQL-looking input through as a value, never as SQL", () => {
    const where = caseWhere({ q: "'; DROP TABLE \"ModCase\"; --" });
    expect(where.OR?.[0]).toEqual({ targetName: { contains: "'; DROP TABLE \"ModCase\"; --", mode: "insensitive" } });
  });
});

describe("caseQueryString", () => {
  it("omits defaults", () => {
    expect(caseQueryString({})).toBe("");
    expect(caseQueryString({ page: 1 })).toBe("");
  });
  it("builds and encodes the query", () => {
    expect(caseQueryString({ type: "ban", q: "a b&c", page: 2 })).toBe("?type=ban&q=a+b%26c&page=2");
  });
});

describe("caseNumberSchema", () => {
  it("accepts positive integers, also as strings from the URL", () => {
    expect(caseNumberSchema.parse("12")).toBe(12);
    expect(caseNumberSchema.parse(5)).toBe(5);
  });
  it("rejects everything else", () => {
    for (const bad of ["0", "-1", "1.5", "abc", "", "99999999999", null, undefined]) {
      expect(caseNumberSchema.safeParse(bad).success, String(bad)).toBe(false);
    }
  });
});

describe("settingsSchema", () => {
  const base = {
    logChannelId: "",
    dmOnAction: true,
    escalationEnabled: false,
    escalationThreshold: 3,
    escalationAction: "timeout",
    escalationDuration: "1h",
  } as const;
  const parse = (over: Record<string, unknown>) => settingsSchema.safeParse({ ...base, ...over });

  it("accepts a channel ID or none", () => {
    expect(parse({ logChannelId: "123456789012345678" }).success).toBe(true);
    expect(parse({ logChannelId: "", dmOnAction: false }).success).toBe(true);
  });

  it("rejects anything that isn't a Discord ID", () => {
    for (const bad of ["abc", "123", "123456789012345678<script>", " 123456789012345678"]) {
      expect(parse({ logChannelId: bad }).success, bad).toBe(false);
    }
    expect(parse({ dmOnAction: "yes" }).success).toBe(false);
    expect(settingsSchema.safeParse({ logChannelId: "" }).success).toBe(false);
  });

  describe("escalation", () => {
    const on = { escalationEnabled: true };

    it("is not checked while it is off", () => {
      expect(parse({ escalationAction: "kick", escalationDuration: "nonsense" }).success).toBe(true);
    });

    it("needs a readable timeout length within Discord's limits", () => {
      expect(parse({ ...on, escalationAction: "timeout", escalationDuration: "1h" }).success).toBe(true);
      expect(parse({ ...on, escalationAction: "timeout", escalationDuration: "" }).success).toBe(false);
      expect(parse({ ...on, escalationAction: "timeout", escalationDuration: "10s" }).success).toBe(false);
      expect(parse({ ...on, escalationAction: "timeout", escalationDuration: "5w" }).success).toBe(false);
      expect(parse({ ...on, escalationAction: "timeout", escalationDuration: "soon" }).success).toBe(false);
    });

    it("gives a kick no length, and a ban an optional one", () => {
      expect(parse({ ...on, escalationAction: "kick", escalationDuration: "" }).success).toBe(true);
      expect(parse({ ...on, escalationAction: "kick", escalationDuration: "1h" }).success).toBe(false);
      expect(parse({ ...on, escalationAction: "ban", escalationDuration: "" }).success).toBe(true);
      expect(parse({ ...on, escalationAction: "ban", escalationDuration: "3d" }).success).toBe(true);
      expect(parse({ ...on, escalationAction: "ban", escalationDuration: "5s" }).success).toBe(false);
    });

    it("keeps the warning count between 2 and 20", () => {
      expect(parse({ ...on, escalationThreshold: 1 }).success).toBe(false);
      expect(parse({ ...on, escalationThreshold: 21 }).success).toBe(false);
      expect(parse({ ...on, escalationThreshold: 2 }).success).toBe(true);
    });

    it("refuses an unknown action", () => {
      expect(parse({ ...on, escalationAction: "mute" }).success).toBe(false);
    });
  });
});
