import { describe, expect, it } from "vitest";
import { startOfRoom, type LobbyDefaults, type Preference } from "./preference";

const policy = { words: ["secret"], useDefaultList: true };
const lobby: LobbyDefaults = { name: "Sam's room", userLimit: 0, allowVideo: true, allowSoundboard: true };
const pref: Preference = { name: "Chill zone", userLimit: 5, locked: true, videoAllowed: false, soundboardAllowed: true };

describe("startOfRoom", () => {
  it("uses the lobby's own values for a member with nothing remembered", () => {
    expect(startOfRoom(lobby, null, policy)).toEqual({ name: "Sam's room", userLimit: 0, locked: false, allowVideo: true, allowSoundboard: true });
  });
  it("carries the remembered name, limit, lock and switches over", () => {
    expect(startOfRoom(lobby, pref, policy)).toEqual({ name: "Chill zone", userLimit: 5, locked: true, allowVideo: false, allowSoundboard: true });
  });
  it("checks the remembered name against the blocklist again", () => {
    expect(startOfRoom(lobby, { ...pref, name: "my secret place" }, policy).name).toBe("Sam's room");
    expect(startOfRoom(lobby, { ...pref, name: "\u200b\u200b" }, policy).name).toBe("Sam's room");
  });
  it("keeps the limit inside Discord's range", () => {
    expect(startOfRoom(lobby, { ...pref, userLimit: 500 }, policy).userLimit).toBe(99);
    expect(startOfRoom(lobby, { ...pref, userLimit: -3 }, policy).userLimit).toBe(0);
  });
  it("never turns on what the lobby switches off", () => {
    const strict: LobbyDefaults = { ...lobby, allowVideo: false, allowSoundboard: false };
    const r = startOfRoom(strict, { ...pref, videoAllowed: true, soundboardAllowed: true }, policy);
    expect(r.allowVideo).toBe(false);
    expect(r.allowSoundboard).toBe(false);
  });
});
