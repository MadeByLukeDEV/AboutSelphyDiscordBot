import { describe, expect, it, vi } from "vitest";
import type { Client } from "discord.js";
import { backoffMs, isPermanentLoginError, loginWithRetry, MAX_LOGIN_ATTEMPTS } from "./login";

const client = (login: () => Promise<string>) => ({ login }) as unknown as Client;
const noSleep = () => Promise.resolve();

describe("backoffMs", () => {
  it("doubles from one second and stops at a minute", () => {
    expect([0, 1, 2, 3, 5, 6, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 32000, 60000, 60000]);
  });
});

describe("isPermanentLoginError", () => {
  it("knows a bad token and missing intents", () => {
    for (const code of ["TokenInvalid", "DisallowedIntents"]) expect(isPermanentLoginError({ code })).toBe(true);
    expect(isPermanentLoginError({ code: "ETIMEDOUT" })).toBe(false);
    expect(isPermanentLoginError(new Error("x"))).toBe(false);
  });
});

describe("loginWithRetry", () => {
  it("retries a network failure and then succeeds", async () => {
    const login = vi.fn().mockRejectedValueOnce(new Error("timeout")).mockRejectedValueOnce(new Error("timeout")).mockResolvedValue("ok");
    await loginWithRetry(client(login), "t", noSleep);
    expect(login).toHaveBeenCalledTimes(3);
  });
  it("gives up at once on a bad token", async () => {
    const login = vi.fn().mockRejectedValue(Object.assign(new Error("bad"), { code: "TokenInvalid" }));
    await expect(loginWithRetry(client(login), "t", noSleep)).rejects.toThrow("bad");
    expect(login).toHaveBeenCalledTimes(1);
  });
  it("gives up after the last attempt", async () => {
    const login = vi.fn().mockRejectedValue(new Error("down"));
    await expect(loginWithRetry(client(login), "t", noSleep)).rejects.toThrow("down");
    expect(login).toHaveBeenCalledTimes(MAX_LOGIN_ATTEMPTS);
  });
});
