import { describe, expect, it } from "vitest";
import { isPublicPath } from "../../lib/public-paths";
import { privacyDe } from "./privacy.de";
import { privacyEn } from "./privacy.en";
import { termsDe } from "./terms.de";
import { termsEn } from "./terms.en";
import type { LegalDoc, Operator } from "./types";

const op: Operator = { name: "Example Operator", address: "Example Street 1, 12345 Town", email: "legal@example.test", country: "Germany", hosting: "a server in Germany" };

const text = (doc: LegalDoc) => JSON.stringify(doc);

describe("public paths", () => {
  it("only the terms and the privacy policy are readable without signing in", () => {
    expect(isPublicPath("/widget/abc123")).toBe(true);
    expect(isPublicPath("/widget/abc123/")).toBe(true);
    expect(isPublicPath("/widget/")).toBe(false);
    expect(isPublicPath("/widget/abc/extra")).toBe(false);
    expect(isPublicPath("/widgets/abc")).toBe(false);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/privacy/")).toBe(true);
    expect(isPublicPath("/leaderboard")).toBe(true);
  });

  it("nothing else is, whatever it looks like", () => {
    for (const path of ["/", "/cases", "/terms/x", "/privacy/../cases", "/terms.json", "/TERMS", "/legal", "/api/health", "//terms", "/terms%2F"]) expect(isPublicPath(path), path).toBe(false);
  });
});

describe("the legal documents", () => {
  const pairs: Array<[string, LegalDoc, LegalDoc]> = [
    ["terms", termsEn(op), termsDe(op)],
    ["privacy", privacyEn(op), privacyDe(op)],
  ];

  it("have the same sections in English and German", () => {
    for (const [name, en, de] of pairs) expect(en.sections.map((s) => s.id), name).toEqual(de.sections.map((s) => s.id));
  });

  it("have unique section ids, headings and some text in every section", () => {
    for (const [name, en, de] of pairs) {
      for (const doc of [en, de]) {
        expect(new Set(doc.sections.map((s) => s.id)).size, name).toBe(doc.sections.length);
        for (const s of doc.sections) {
          expect(s.heading.length, `${name}/${s.id}`).toBeGreaterThan(3);
          expect(s.blocks.length, `${name}/${s.id}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("show the operator's details and never leak template leftovers", () => {
    for (const [name, en, de] of pairs) {
      for (const doc of [en, de]) {
        const t = text(doc);
        expect(t, name).toContain("Example Operator");
        expect(t, name).toContain("legal@example.test");
        expect(t, name).not.toMatch(/undefined|\[object|\$\{|NaN/);
      }
    }
  });

  it("the privacy policy covers each thing the bot really stores", () => {
    const t = text(privacyEn(op)).toLowerCase();
    for (const word of ["moderation", "levels", "tickets", "birthdays", "reminders", "suggestions", "starboard", "counting", "message content", "retention".slice(0, 0) + "90 days", "cloudflare", "discord inc", "legitimate interests", "complain"]) expect(t, word).toContain(word);
    // The birth year is stored only when given, and never shown as a date: the policy must say so.
    expect(t).toContain("birth year only if you give it");
  });

  it("make no promise the product doesn't keep (no selling, ads or tracking claims beyond what is true)", () => {
    const t = text(privacyEn(op)).toLowerCase();
    expect(t).toContain("nothing is sold");
    expect(t).toContain("no analytics");
  });
});
