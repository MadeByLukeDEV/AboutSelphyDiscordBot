import { describe, expect, it } from "vitest";
import { envSchema } from "./env";

const base = {
  DISCORD_BOT_TOKEN: "x".repeat(60),
  DISCORD_APP_ID: "123456789012345678",
  DISCORD_GUILD_ID: "123456789012345678",
  DISCORD_ADMIN_ROLE_IDS: "123456789012345678",
  DISCORD_MODERATOR_ROLE_IDS: "123456789012345679",
  DATABASE_URL: "postgres://x",
  BOT_API_SECRET: "s".repeat(40),
};

describe("optional AI settings", () => {
  it("treats empty values as not configured (the compose file passes unset variables as empty strings)", () => {
    const r = envSchema.safeParse({ ...base, AI_API_KEY: "", AI_BASE_URL: "", AI_MODEL: "", AI_REASONING_EFFORT: "" });
    expect(r.success).toBe(true);
    if (r.success) expect([r.data.AI_API_KEY, r.data.AI_BASE_URL, r.data.AI_MODEL, r.data.AI_REASONING_EFFORT]).toEqual([undefined, undefined, undefined, undefined]);
  });
  it("accepts a complete configuration", () => {
    const r = envSchema.safeParse({ ...base, AI_API_KEY: "key", AI_BASE_URL: "https://generativelanguage.googleapis.com/v1beta/openai/", AI_MODEL: "gemini-3.8-flash", AI_REASONING_EFFORT: "low" });
    expect(r.success).toBe(true);
  });
  it("refuses a plain http address and an unknown effort", () => {
    expect(envSchema.safeParse({ ...base, AI_BASE_URL: "http://example.com/v1" }).success).toBe(false);
    expect(envSchema.safeParse({ ...base, AI_REASONING_EFFORT: "extreme" }).success).toBe(false);
  });
});
