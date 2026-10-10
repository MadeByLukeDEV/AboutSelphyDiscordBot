import { PermissionFlagsBits as P } from "discord.js";
import { describe, expect, it } from "vitest";
import { SlidingWindowLimiter } from "../../lib/sliding-window";
import { tempVoiceRoom } from "@aboutselphy/shared";
import { summarizeRoom } from "./overview";
import { buildPanel, PANEL_ACTIONS, panelId, parsePanelId } from "./panel";
import { canClaimRoom, canManageRoom, checkTarget, deriveRoomState, type OverwriteBits, type RoomState } from "./state";

const EVERYONE = "100000000000000000";
const OWNER = "200000000000000001";
const BOT = "300000000000000001";

const role = (id: string, allow = 0n, deny = 0n): OverwriteBits => ({ id, kind: "role", allow, deny });
const member = (id: string, allow = 0n, deny = 0n): OverwriteBits => ({ id, kind: "member", allow, deny });
const derive = (overwrites: OverwriteBits[], userLimit = 0) =>
  deriveRoomState({ overwrites, everyoneId: EVERYONE, ownerId: OWNER, botId: BOT, userLimit });

describe("deriveRoomState", () => {
  it("reads a fresh room: open, video and soundboard on", () => {
    const state = derive([role(EVERYONE, P.Stream | P.UseSoundboard, 0n), member(OWNER, P.Connect | P.ViewChannel)]);
    expect(state).toEqual({
      locked: false,
      videoAllowed: true,
      soundboardAllowed: true,
      userLimit: 0,
      allowedIds: [],
      blockedIds: [],
    });
  });

  it("reads a locked room with video and soundboard off", () => {
    const state = derive([role(EVERYONE, 0n, P.Connect | P.Stream | P.UseSoundboard)], 4);
    expect(state).toMatchObject({ locked: true, videoAllowed: false, soundboardAllowed: false, userLimit: 4 });
  });

  it("lists who is let in and who is blocked, but not the owner or the bot", () => {
    const state = derive([
      role(EVERYONE, 0n, P.Connect),
      member(OWNER, P.Connect),
      member(BOT, P.Connect),
      member("400000000000000001", P.Connect | P.ViewChannel),
      member("400000000000000002", 0n, P.Connect),
    ]);
    expect(state.allowedIds).toEqual(["400000000000000001"]);
    expect(state.blockedIds).toEqual(["400000000000000002"]);
  });

  it("treats a missing @everyone overwrite as open with everything on", () => {
    expect(derive([])).toMatchObject({ locked: false, videoAllowed: true, soundboardAllowed: true });
  });

  it("doesn't confuse a role overwrite with a member of the same ID", () => {
    const state = derive([member(EVERYONE, 0n, P.Connect)]);
    expect(state.locked).toBe(false);
  });
});

describe("canManageRoom", () => {
  it("allows the owner and staff, nobody else", () => {
    expect(canManageRoom({ userId: OWNER, ownerId: OWNER, isStaff: false })).toBe(true);
    expect(canManageRoom({ userId: "x", ownerId: OWNER, isStaff: true })).toBe(true);
    expect(canManageRoom({ userId: "x", ownerId: OWNER, isStaff: false })).toBe(false);
  });
});

describe("canClaimRoom", () => {
  const base = { userId: "u", ownerId: OWNER, userInRoom: true, ownerInRoom: false };
  it("lets someone in the room take over once the owner has left", () => {
    expect(canClaimRoom(base)).toBe(true);
  });
  it("refuses while the owner is still in the room (no stealing)", () => {
    expect(canClaimRoom({ ...base, ownerInRoom: true })).toBe(false);
  });
  it("refuses people who aren't in the room, and the owner themself", () => {
    expect(canClaimRoom({ ...base, userInRoom: false })).toBe(false);
    expect(canClaimRoom({ ...base, userId: OWNER })).toBe(false);
  });
});

describe("checkTarget", () => {
  const base = {
    action: "kick" as const,
    actorId: OWNER,
    actorIsStaff: false,
    actorIsServerOwner: false,
    targetId: "t",
    targetIsBot: false,
    targetIsStaff: false,
    targetIsServerOwner: false,
    roomOwnerId: OWNER,
  };

  it("lets an owner kick and block an ordinary member", () => {
    expect(checkTarget(base)).toEqual({ ok: true });
    expect(checkTarget({ ...base, action: "block" })).toEqual({ ok: true });
  });
  it("refuses kicking or blocking yourself, or transferring to yourself", () => {
    expect(checkTarget({ ...base, targetId: OWNER })).toEqual({ ok: false, reason: "self" });
    expect(checkTarget({ ...base, action: "transfer", targetId: OWNER })).toEqual({ ok: false, reason: "self" });
  });
  it("protects moderators and the server owner from a room owner", () => {
    expect(checkTarget({ ...base, targetIsStaff: true })).toEqual({ ok: false, reason: "staff" });
    expect(checkTarget({ ...base, targetIsServerOwner: true, targetIsStaff: true })).toEqual({ ok: false, reason: "serverOwner" });
  });
  it("lets staff act on anyone in a room except the server owner", () => {
    const staff = { ...base, actorId: "mod", actorIsStaff: true };
    expect(checkTarget({ ...staff, targetId: OWNER })).toEqual({ ok: true });
    expect(checkTarget({ ...staff, targetIsStaff: true })).toEqual({ ok: true });
    expect(checkTarget({ ...staff, targetIsServerOwner: true })).toEqual({ ok: false, reason: "serverOwner" });
    expect(checkTarget({ ...staff, actorIsServerOwner: true, targetIsServerOwner: true, targetId: "o" })).toEqual({ ok: true });
  });
  it("protects the room owner from other members, who could otherwise be given the buttons", () => {
    expect(checkTarget({ ...base, actorId: "someone", targetId: OWNER })).toEqual({ ok: false, reason: "owner" });
  });
  it("refuses handing the room to a bot, but allows kicking one", () => {
    expect(checkTarget({ ...base, action: "transfer", targetIsBot: true })).toEqual({ ok: false, reason: "bot" });
    expect(checkTarget({ ...base, targetIsBot: true })).toEqual({ ok: true });
  });
  it("allows letting in, removing from the list and unblocking anyone", () => {
    for (const action of ["allow", "remove", "unblock"] as const) {
      expect(checkTarget({ ...base, action, targetIsStaff: true })).toEqual({ ok: true });
    }
  });
});

describe("panel custom IDs", () => {
  it("round-trips every action", () => {
    for (const action of PANEL_ACTIONS) {
      expect(parsePanelId(panelId(action, "123456789012345678"))).toEqual({ action, channelId: "123456789012345678" });
    }
  });
  it("rejects anything that isn't exactly our format", () => {
    for (const bad of ["", "tv", "tv:lock", "tv:lock:abc", "tv:nope:123456789012345678", "x:lock:123456789012345678", "tv:lock:123456789012345678:extra", "tv:lock:1234"]) {
      expect(parsePanelId(bad), bad).toBeNull();
    }
  });
});

describe("buildPanel", () => {
  const open: RoomState = { locked: false, videoAllowed: true, soundboardAllowed: true, userLimit: 0, allowedIds: [], blockedIds: [] };
  const channelId = "123456789012345678";

  it("fits Discord's limits: at most 5 rows, 5 buttons in the button row, IDs under 100 characters", () => {
    const { components } = buildPanel({ channelId, ownerId: OWNER, state: open });
    expect(components.length).toBeLessThanOrEqual(5);
    expect(components[0]!.components).toHaveLength(5);
    for (const row of components) {
      for (const c of row.components) {
        const id = (c.toJSON() as { custom_id: string }).custom_id;
        expect(id.length).toBeLessThanOrEqual(100);
        expect(parsePanelId(id)).not.toBeNull();
      }
    }
  });

  it("shows the state and flips the labels", () => {
    const locked = buildPanel({
      channelId,
      ownerId: OWNER,
      state: { ...open, locked: true, videoAllowed: false, userLimit: 5, allowedIds: ["400000000000000001"], blockedIds: [] },
    });
    const labels = locked.components[0]!.components.map((c) => (c.toJSON() as { label: string }).label);
    expect(labels).toEqual(["Rename", "Member limit", "Unlock room", "Video: off", "Soundboard: on"]);
    const text = JSON.stringify(locked.embeds[0]!.toJSON());
    expect(text).toContain("Locked");
    expect(text).toContain("<@400000000000000001>");
    expect(text).toContain(`<@${OWNER}>`);
  });

  it("keeps long lists inside the embed field limit", () => {
    const many = Array.from({ length: 80 }, (_, i) => `4000000000000${String(10000 + i)}`);
    const json = buildPanel({ channelId, ownerId: OWNER, state: { ...open, allowedIds: many, blockedIds: many } }).embeds[0]!.toJSON();
    for (const f of json.fields ?? []) expect(f.value.length).toBeLessThanOrEqual(1024);
    expect(JSON.stringify(json)).toContain("and 70 more");
  });
});

describe("SlidingWindowLimiter", () => {
  it("allows the first N uses in a window and blocks the next, like Discord's 2 renames per 10 minutes", () => {
    let now = 0;
    const limiter = new SlidingWindowLimiter(2, 600_000, () => now);
    expect(limiter.tryAcquire("room")).toBe(true);
    now += 1000;
    expect(limiter.tryAcquire("room")).toBe(true);
    now += 1000;
    expect(limiter.tryAcquire("room")).toBe(false);
    expect(limiter.retryAfterSeconds("room")).toBe(598);
  });
  it("frees a slot as the oldest use leaves the window", () => {
    let now = 0;
    const limiter = new SlidingWindowLimiter(2, 600_000, () => now);
    limiter.tryAcquire("r");
    now += 300_000;
    limiter.tryAcquire("r");
    now += 300_000; // the first use is exactly 10 minutes old
    expect(limiter.tryAcquire("r")).toBe(true);
    expect(limiter.tryAcquire("r")).toBe(false);
  });
  it("tracks rooms independently, forgets cleared ones, and a refused attempt isn't recorded", () => {
    let now = 0;
    const limiter = new SlidingWindowLimiter(1, 1000, () => now);
    expect(limiter.tryAcquire("a")).toBe(true);
    expect(limiter.tryAcquire("b")).toBe(true);
    expect(limiter.tryAcquire("a")).toBe(false);
    limiter.clear("a");
    expect(limiter.tryAcquire("a")).toBe(true);
    now += 1000;
    expect(limiter.retryAfterSeconds("a")).toBe(0);
  });
});

describe("summarizeRoom", () => {
  const state: RoomState = { locked: true, videoAllowed: false, soundboardAllowed: true, userLimit: 6, allowedIds: ["a", "b"], blockedIds: ["c"] };
  const base = {
    channelId: "123456789012345678",
    name: "Selphy's room",
    ownerId: OWNER,
    ownerName: "Selphy",
    state,
    lobbyChannelId: "900000000000000001",
    createdAt: new Date("2026-10-10T20:00:00Z"),
  };

  it("reports counts and flags from the room state", () => {
    const summary = summarizeRoom({ ...base, members: [{ id: "1", name: "A" }, { id: "2", name: "B" }] });
    expect(summary).toMatchObject({
      memberCount: 2,
      locked: true,
      userLimit: 6,
      videoAllowed: false,
      soundboardAllowed: true,
      allowedCount: 2,
      blockedCount: 1,
      createdAt: "2026-10-10T20:00:00.000Z",
    });
    expect(summary.members).toHaveLength(2);
  });

  it("caps the listed members but keeps the real count", () => {
    const members = Array.from({ length: 40 }, (_, i) => ({ id: String(i), name: `m${i}` }));
    const summary = summarizeRoom({ ...base, members });
    expect(summary.memberCount).toBe(40);
    expect(summary.members).toHaveLength(25);
  });

  it("matches the contract the dashboard validates", () => {
    const summary = summarizeRoom({ ...base, ownerName: null, members: [] });
    expect(tempVoiceRoom.safeParse(summary).success).toBe(true);
  });
});
