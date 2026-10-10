import { OverwriteType, PermissionFlagsBits as P } from "discord.js";
import { describe, expect, it } from "vitest";
import { Cooldown } from "../../lib/cooldown";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { checkRename, findBlockedWord, isBlocked, policyOf, renderRoomName, sanitizeRoomName } from "./name";
import { initialOverwrites, missingBotPermissions } from "./permissions";
import { planTransition } from "./transition";

/** Only the admin's own words, built-in list off: keeps these tests about one thing at a time. */
const custom = (words: string[] = []) => ({ words, useDefaultList: false });
const withDefaults = (words: string[] = []) => ({ words, useDefaultList: true });

describe("the block policy", () => {
  it("applies the built-in list only when it is switched on", () => {
    expect(isBlocked("what the fuck", withDefaults())).toBe(true);
    expect(isBlocked("what the fuck", custom())).toBe(false);
  });
  it("applies the admin's own words whether or not the built-in list is on", () => {
    expect(isBlocked("Secret Club", custom(["secret"]))).toBe(true);
    expect(isBlocked("Secret Club", withDefaults(["secret"]))).toBe(true);
  });
  it("lets ordinary names through with the built-in list on", () => {
    for (const name of ["Selphy's room", "Assassin's Creed night", "Movie night", "Class of 2026"]) {
      expect(isBlocked(name, withDefaults()), name).toBe(false);
    }
  });
  it("builds the policy from the saved settings, tolerating a null list", () => {
    expect(policyOf({ blockedWords: ["a"], useDefaultBlocklist: true })).toEqual({ words: ["a"], useDefaultList: true });
    expect(policyOf({ blockedWords: null, useDefaultBlocklist: false })).toEqual({ words: [], useDefaultList: false });
  });
  it("replaces a room name that would be blocked, and refuses a blocked rename", () => {
    expect(renderRoomName("{user}'s room", "Fuck123", withDefaults())).toBe("Voice room");
    expect(renderRoomName("{user}'s room", "Fuck123", custom())).toBe("Fuck123's room");
    expect(checkRename("sh1t room", withDefaults())).toEqual({ ok: false, reason: "blocked" });
    expect(checkRename("sh1t room", custom())).toEqual({ ok: true, name: "sh1t room" });
  });
});

describe("sanitizeRoomName", () => {
  it("removes control and zero-width characters and collapses whitespace", () => {
    expect(sanitizeRoomName("  Chill ​‍zone \n\t room  ")).toBe("Chill zone room");
  });
  it("cuts to 100 characters without splitting an emoji", () => {
    const out = sanitizeRoomName("😀".repeat(150));
    expect([...out]).toHaveLength(100);
    expect(out).toBe("😀".repeat(100));
  });
  it("gives an empty string for nothing usable", () => {
    expect(sanitizeRoomName("​ \u0007 ")).toBe("");
  });
});

describe("findBlockedWord", () => {
  const words = ["badword", "Slur"];
  it("matches case-insensitively and inside other text", () => {
    expect(findBlockedWord("My BADWORD room", words)).toBe("badword");
    expect(findBlockedWord("a slur here", words)).toBe("Slur");
  });
  it("sees through zero-width characters and fullwidth letters", () => {
    expect(findBlockedWord("bad​word", words)).toBe("badword");
    expect(findBlockedWord("ｂａｄｗｏｒｄ", words)).toBe("badword");
  });
  it("returns null for clean text, an empty list and blank entries", () => {
    expect(findBlockedWord("friendly room", words)).toBeNull();
    expect(findBlockedWord("anything", [])).toBeNull();
    expect(findBlockedWord("anything", ["", "  "])).toBeNull();
  });
});

describe("renderRoomName", () => {
  it("fills {user} in the template", () => {
    expect(renderRoomName("{user}'s room", "Selphy", custom())).toBe("Selphy's room");
    expect(renderRoomName("Room of {user} ({user})", "A", custom())).toBe("Room of A (A)");
  });
  it("falls back when the display name contains a blocked word", () => {
    expect(renderRoomName("{user}'s room", "BadWord123", custom(["badword"]))).toBe("Voice room");
  });
  it("falls back when nothing usable is left", () => {
    expect(renderRoomName("{user}", "​", custom())).toBe("Voice room");
  });
  it("keeps a template without a placeholder as is", () => {
    expect(renderRoomName("Hangout", "Selphy", custom())).toBe("Hangout");
  });
});

describe("checkRename", () => {
  it("accepts a clean name, sanitised", () => {
    expect(checkRename("  Movie   night ", custom(["x"]))).toEqual({ ok: true, name: "Movie night" });
  });
  it("refuses empty and blocked names with a reason", () => {
    expect(checkRename("   ", custom())).toEqual({ ok: false, reason: "empty" });
    expect(checkRename("so BADWORD", custom(["badword"]))).toEqual({ ok: false, reason: "blocked" });
  });
});

describe("planTransition", () => {
  const base = { enabled: true, lobbyChannelIds: new Set(["L", "L2"]), isRoom: (id: string) => id === "R1" || id === "R2" };
  const none = { createFromLobby: null, checkEmpty: null };

  it("creates a room when someone joins a lobby, from the lobby they joined", () => {
    expect(planTransition({ ...base, oldChannelId: null, newChannelId: "L" })).toEqual({ createFromLobby: "L", checkEmpty: null });
    expect(planTransition({ ...base, oldChannelId: null, newChannelId: "L2" })).toEqual({ createFromLobby: "L2", checkEmpty: null });
  });
  it("creates a room and checks the old one when moving from a room to a lobby", () => {
    expect(planTransition({ ...base, oldChannelId: "R1", newChannelId: "L2" })).toEqual({ createFromLobby: "L2", checkEmpty: "R1" });
  });
  it("checks a room for emptiness when someone leaves or disconnects", () => {
    expect(planTransition({ ...base, oldChannelId: "R1", newChannelId: null })).toEqual({ createFromLobby: null, checkEmpty: "R1" });
    expect(planTransition({ ...base, oldChannelId: "R1", newChannelId: "R2" })).toEqual({ createFromLobby: null, checkEmpty: "R1" });
  });
  it("ignores changes inside one channel (mute, deafen, camera)", () => {
    expect(planTransition({ ...base, oldChannelId: "R1", newChannelId: "R1" })).toEqual(none);
    expect(planTransition({ ...base, oldChannelId: "L", newChannelId: "L" })).toEqual(none);
  });
  it("ignores channels that aren't ours", () => {
    expect(planTransition({ ...base, oldChannelId: "other", newChannelId: "elsewhere" })).toEqual(none);
  });
  it("creates nothing while the master switch is off, but still cleans up rooms", () => {
    expect(planTransition({ ...base, enabled: false, oldChannelId: "R1", newChannelId: "L" })).toEqual({ createFromLobby: null, checkEmpty: "R1" });
  });
  it("creates nothing without lobbies, or from a channel that isn't a (switched-on) lobby", () => {
    expect(planTransition({ ...base, lobbyChannelIds: new Set(), oldChannelId: null, newChannelId: "L" })).toEqual(none);
    // A paused lobby is simply absent from the set the caller passes in.
    expect(planTransition({ ...base, lobbyChannelIds: new Set(["L"]), oldChannelId: null, newChannelId: "L2" })).toEqual(none);
  });
  it("a room is never also a lobby: joining a room doesn't create one", () => {
    expect(planTransition({ ...base, oldChannelId: null, newChannelId: "R1" })).toEqual(none);
  });
});

describe("initialOverwrites", () => {
  const opts = { everyoneId: "E", ownerId: "O", allowVideo: true, allowSoundboard: true };

  it("allows video and soundboard for everyone by default", () => {
    const [everyone] = initialOverwrites(opts);
    expect(everyone).toMatchObject({ id: "E", type: OverwriteType.Role, deny: [] });
    expect(everyone!.allow).toEqual([P.Stream, P.UseSoundboard, P.UseExternalSounds]);
  });
  it("denies them explicitly when switched off, so the category can't override the setting", () => {
    const [everyone] = initialOverwrites({ ...opts, allowVideo: false, allowSoundboard: false });
    expect(everyone!.allow).toEqual([]);
    expect(everyone!.deny).toEqual([P.Stream, P.UseSoundboard, P.UseExternalSounds]);
  });
  it("handles video and soundboard independently", () => {
    const [everyone] = initialOverwrites({ ...opts, allowVideo: false });
    expect(everyone!.deny).toEqual([P.Stream]);
    expect(everyone!.allow).toEqual([P.UseSoundboard, P.UseExternalSounds]);
  });
  it("gives the owner only view and connect, never channel management", () => {
    const owner = initialOverwrites(opts)[1]!;
    expect(owner).toMatchObject({ id: "O", type: OverwriteType.Member, deny: [] });
    expect(owner.allow).toEqual([P.ViewChannel, P.Connect]);
    expect(owner.allow).not.toContain(P.ManageChannels);
    expect(owner.allow).not.toContain(P.MoveMembers);
  });
});

describe("missingBotPermissions", () => {
  it("lists what the bot lacks", () => {
    expect(missingBotPermissions(() => true)).toEqual([]);
    expect(missingBotPermissions((flag) => flag !== P.ManageChannels && flag !== P.MoveMembers)).toEqual([
      "ManageChannels",
      "MoveMembers",
    ]);
  });
});

describe("KeyedMutex", () => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("runs tasks for the same key strictly one after another, in order", async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    const task = (name: string, ms: number) => async () => {
      log.push(`start ${name}`);
      await wait(ms);
      log.push(`end ${name}`);
    };
    await Promise.all([mutex.run("room", task("a", 30)), mutex.run("room", task("b", 5)), mutex.run("room", task("c", 1))]);
    expect(log).toEqual(["start a", "end a", "start b", "end b", "start c", "end c"]);
  });

  it("lets different keys run in parallel", async () => {
    const mutex = new KeyedMutex();
    const log: string[] = [];
    await Promise.all([
      mutex.run("a", async () => { log.push("a1"); await wait(20); log.push("a2"); }),
      mutex.run("b", async () => { log.push("b1"); await wait(1); log.push("b2"); }),
    ]);
    expect(log.indexOf("b2")).toBeLessThan(log.indexOf("a2"));
  });

  it("a failing task rejects its own caller but doesn't block the queue", async () => {
    const mutex = new KeyedMutex();
    const failing = mutex.run("k", async () => { throw new Error("boom"); });
    const next = mutex.run("k", async () => "still runs");
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("still runs");
  });

  it("forgets keys once idle", async () => {
    const mutex = new KeyedMutex();
    await mutex.run("x", async () => 1);
    await wait(1);
    expect(mutex.size).toBe(0);
  });
});

describe("Cooldown", () => {
  it("blocks repeats within the window and allows them after", () => {
    let now = 1000;
    const cd = new Cooldown(5000, () => now);
    expect(cd.tryAcquire("u")).toBe(true);
    now += 4999;
    expect(cd.tryAcquire("u")).toBe(false);
    now += 1;
    expect(cd.tryAcquire("u")).toBe(true);
  });
  it("tracks keys independently and reports the time left", () => {
    let now = 0;
    const cd = new Cooldown(10_000, () => now);
    cd.tryAcquire("a");
    expect(cd.tryAcquire("b")).toBe(true);
    now += 2500;
    expect(cd.remainingSeconds("a")).toBe(8);
    expect(cd.remainingSeconds("never")).toBe(0);
  });
});
