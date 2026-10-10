import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { ChannelType } from "discord.js";
import { describe, expect, it } from "vitest";
import { BodyError, readJsonBody } from "./body";
import { mapChannels } from "./guild";
import { resolveApiHost } from "./host";

describe("resolveApiHost", () => {
  it("listens on loopback only outside production", () => {
    expect(resolveApiHost("local")).toBe("127.0.0.1");
  });
  it("listens on all interfaces in production, for the dashboard container", () => {
    expect(resolveApiHost("production")).toBe("0.0.0.0");
  });
  it("lets BOT_API_HOST override both, ignoring blanks", () => {
    expect(resolveApiHost("local", "0.0.0.0")).toBe("0.0.0.0");
    expect(resolveApiHost("production", "10.0.0.5")).toBe("10.0.0.5");
    expect(resolveApiHost("local", "   ")).toBe("127.0.0.1");
    expect(resolveApiHost("production", "")).toBe("0.0.0.0");
  });
});

const chat = { name: "Chat", rawPosition: 0 };
const voice = { name: "Voice", rawPosition: 5 };

const channels = [
  { id: "100000000000000001", name: "general", type: ChannelType.GuildText, parent: chat, rawPosition: 1 },
  { id: "100000000000000002", name: "news", type: ChannelType.GuildAnnouncement, parent: chat, rawPosition: 0 },
  { id: "100000000000000003", name: "Lobby", type: ChannelType.GuildVoice, parent: voice, rawPosition: 0 },
  { id: "100000000000000004", name: "Voice", type: ChannelType.GuildCategory, parent: null, rawPosition: 5 },
  { id: "100000000000000005", name: "threads", type: ChannelType.PublicThread, parent: chat, rawPosition: 0 },
  { id: "100000000000000006", name: "rules", type: ChannelType.GuildText, parent: null, rawPosition: 0 },
  { id: "100000000000000007", name: "Chat", type: ChannelType.GuildCategory, parent: null, rawPosition: 0 },
];

describe("mapChannels", () => {
  it("keeps only the requested kinds and treats announcement channels as text", () => {
    const text = mapChannels(channels, new Set(["text"]));
    expect(text.map((c) => c.name)).toEqual(["rules", "news", "general"]);
    expect(text.every((c) => c.kind === "text")).toBe(true);
  });

  it("supports several kinds and ignores threads and other types", () => {
    const all = mapChannels(channels, new Set(["text", "voice", "category"]));
    expect(all.map((c) => c.name)).not.toContain("threads");
    expect(all.find((c) => c.name === "Lobby")).toMatchObject({ kind: "voice", parent: "Voice" });
    expect(all.find((c) => c.name === "Voice")).toMatchObject({ kind: "category", parent: null });
  });

  it("orders like Discord's sidebar: uncategorised first, then each category with its channels", () => {
    const all = mapChannels(channels, new Set(["text", "voice", "category"]));
    expect(all.map((c) => c.name)).toEqual(["rules", "Chat", "news", "general", "Voice", "Lobby"]);
  });

  it("orders categories by their position, not by name", () => {
    const zFirst = [
      { id: "200000000000000001", name: "Zeta", type: ChannelType.GuildCategory, parent: null, rawPosition: 0 },
      { id: "200000000000000002", name: "Alpha", type: ChannelType.GuildCategory, parent: null, rawPosition: 1 },
      { id: "200000000000000003", name: "in-zeta", type: ChannelType.GuildText, parent: { name: "Zeta", rawPosition: 0 }, rawPosition: 0 },
      { id: "200000000000000004", name: "in-alpha", type: ChannelType.GuildText, parent: { name: "Alpha", rawPosition: 1 }, rawPosition: 0 },
    ];
    expect(mapChannels(zFirst, new Set(["text"])).map((c) => c.name)).toEqual(["in-zeta", "in-alpha"]);
  });

  it("lists text channels before voice channels inside a category, whatever their positions", () => {
    const cat = { name: "Mixed", rawPosition: 2 };
    const mixed = [
      { id: "300000000000000001", name: "voice-first", type: ChannelType.GuildVoice, parent: cat, rawPosition: 0 },
      { id: "300000000000000002", name: "text-later", type: ChannelType.GuildText, parent: cat, rawPosition: 3 },
    ];
    expect(mapChannels(mixed, new Set(["text", "voice"])).map((c) => c.name)).toEqual(["text-later", "voice-first"]);
  });

  it("breaks position ties by channel ID, like Discord", () => {
    const tie = [
      { id: "400000000000000010", name: "newer", type: ChannelType.GuildText, parent: null, rawPosition: 0 },
      { id: "400000000000000009", name: "older", type: ChannelType.GuildText, parent: null, rawPosition: 0 },
    ];
    expect(mapChannels(tie, new Set(["text"])).map((c) => c.name)).toEqual(["older", "newer"]);
  });

  it("does not leak internal sorting fields", () => {
    for (const c of mapChannels(channels, new Set(["text"]))) {
      // `announcement` is only present (and true) for announcement channels.
      const keys = Object.keys(c).filter((k) => k !== "announcement").sort();
      expect(keys).toEqual(["id", "kind", "name", "parent"]);
      if ("announcement" in c) expect(c.announcement).toBe(true);
    }
  });
});

const request = (body: string | Buffer, contentType: string | null = "application/json") =>
  Object.assign(Readable.from([Buffer.from(body)]), {
    headers: contentType ? { "content-type": contentType } : {},
  }) as unknown as IncomingMessage;

describe("readJsonBody", () => {
  it("parses JSON", async () => {
    await expect(readJsonBody(request('{"caseNumber":5}'))).resolves.toEqual({ caseNumber: 5 });
    await expect(readJsonBody(request("{}", "application/json; charset=utf-8"))).resolves.toEqual({});
  });

  it("rejects other content types with 415", async () => {
    await expect(readJsonBody(request("{}", "text/plain"))).rejects.toMatchObject({ status: 415 });
    await expect(readJsonBody(request("{}", null))).rejects.toMatchObject({ status: 415 });
  });

  it("rejects invalid JSON with 400", async () => {
    await expect(readJsonBody(request("{nope"))).rejects.toMatchObject({ status: 400 });
    await expect(readJsonBody(request(""))).rejects.toBeInstanceOf(BodyError);
  });

  it("rejects oversized bodies with 413", async () => {
    await expect(readJsonBody(request(JSON.stringify({ x: "a".repeat(20_000) })))).rejects.toMatchObject({ status: 413 });
    await expect(readJsonBody(request('{"a":1}'), 4)).rejects.toMatchObject({ status: 413 });
  });
});
