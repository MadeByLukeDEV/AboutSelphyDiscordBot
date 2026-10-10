import { describe, expect, it } from "vitest";
import { isTwitchSocketUrl, parseFrame, RecentIds } from "./protocol";

const frame = (message_type: string, payload: unknown, message_id = "m1") =>
  JSON.stringify({ metadata: { message_id, message_type, message_timestamp: "2026-10-12T10:00:00Z" }, payload });

const online = {
  id: "9001",
  broadcaster_user_id: "42",
  broadcaster_user_login: "selphy",
  broadcaster_user_name: "Selphy",
  type: "live",
  started_at: "2026-10-12T10:00:00Z",
};

describe("parseFrame", () => {
  it("reads the welcome", () => {
    expect(parseFrame(frame("session_welcome", { session: { id: "S1", keepalive_timeout_seconds: 10 } }))).toEqual({
      kind: "welcome",
      messageId: "m1",
      sessionId: "S1",
      keepaliveSeconds: 10,
    });
  });

  it("falls back to 10 s when the welcome has no keepalive value", () => {
    expect(parseFrame(frame("session_welcome", { session: { id: "S1" } }))).toMatchObject({ kind: "welcome", keepaliveSeconds: 10 });
  });

  it("reads keepalives", () => {
    expect(parseFrame(frame("session_keepalive", {}))).toEqual({ kind: "keepalive", messageId: "m1" });
  });

  it("follows a reconnect only to Twitch's own hosts", () => {
    const ok = parseFrame(frame("session_reconnect", { session: { id: "S", reconnect_url: "wss://eventsub.wss.twitch.tv/ws?x=1" } }));
    expect(ok).toMatchObject({ kind: "reconnect", url: "wss://eventsub.wss.twitch.tv/ws?x=1" });
    expect(parseFrame(frame("session_reconnect", { session: { id: "S", reconnect_url: "wss://evil.example/ws" } }))).toBeUndefined();
    expect(parseFrame(frame("session_reconnect", { session: { id: "S", reconnect_url: "ws://eventsub.wss.twitch.tv/ws" } }))).toBeUndefined();
  });

  it("reads stream.online and stream.offline", () => {
    expect(parseFrame(frame("notification", { subscription: { type: "stream.online" }, event: online }))).toMatchObject({
      kind: "online",
      event: { id: "9001", broadcaster_user_id: "42" },
    });
    const offline = { broadcaster_user_id: "42", broadcaster_user_login: "selphy", broadcaster_user_name: "Selphy" };
    expect(parseFrame(frame("notification", { subscription: { type: "stream.offline" }, event: offline }))).toMatchObject({
      kind: "offline",
      event: { broadcaster_user_id: "42" },
    });
  });

  it("reads revocations", () => {
    expect(parseFrame(frame("revocation", { subscription: { type: "stream.online", status: "authorization_revoked" } }))).toMatchObject({
      kind: "revocation",
      status: "authorization_revoked",
    });
  });

  it("skips what it doesn't know and rejects what is malformed", () => {
    expect(parseFrame(frame("something_new", {}))).toMatchObject({ kind: "ignored" });
    expect(parseFrame(frame("notification", { subscription: { type: "channel.follow" }, event: {} }))).toMatchObject({ kind: "ignored" });
    expect(parseFrame("not json")).toBeUndefined();
    expect(parseFrame("[]")).toBeUndefined();
    expect(parseFrame(frame("notification", { subscription: { type: "stream.online" }, event: { id: 5 } }))).toBeUndefined();
  });
});

describe("isTwitchSocketUrl", () => {
  it("accepts only wss on Twitch hosts", () => {
    expect(isTwitchSocketUrl("wss://eventsub.wss.twitch.tv/ws")).toBe(true);
    expect(isTwitchSocketUrl("wss://eventsub.wss.twitch.tv.evil.com/ws")).toBe(false);
    expect(isTwitchSocketUrl("https://eventsub.wss.twitch.tv/ws")).toBe(false);
    expect(isTwitchSocketUrl("nonsense")).toBe(false);
  });
});

describe("RecentIds", () => {
  it("lets an id through once and forgets it after the window", () => {
    const ids = new RecentIds(1000);
    expect(ids.firstTime("a", 0)).toBe(true);
    expect(ids.firstTime("a", 500)).toBe(false);
    expect(ids.firstTime("a", 2000)).toBe(true);
  });
});
