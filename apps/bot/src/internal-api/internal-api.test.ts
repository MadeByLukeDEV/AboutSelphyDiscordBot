import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { ChannelType } from "discord.js";
import { describe, expect, it } from "vitest";
import { BodyError, readJsonBody } from "./body";
import { mapChannels } from "./guild";

const channels = [
  { id: "100000000000000001", name: "general", type: ChannelType.GuildText, parent: { name: "Chat" }, rawPosition: 1 },
  { id: "100000000000000002", name: "news", type: ChannelType.GuildAnnouncement, parent: { name: "Chat" }, rawPosition: 0 },
  { id: "100000000000000003", name: "Lobby", type: ChannelType.GuildVoice, parent: { name: "Voice" }, rawPosition: 0 },
  { id: "100000000000000004", name: "Voice", type: ChannelType.GuildCategory, parent: null, rawPosition: 5 },
  { id: "100000000000000005", name: "threads", type: ChannelType.PublicThread, parent: { name: "Chat" }, rawPosition: 0 },
  { id: "100000000000000006", name: "rules", type: ChannelType.GuildText, parent: null, rawPosition: 0 },
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

  it("orders by category, then by the position shown in Discord", () => {
    const text = mapChannels(channels, new Set(["text"]));
    expect(text.map((c) => c.parent)).toEqual([null, "Chat", "Chat"]);
    expect(text.slice(1).map((c) => c.name)).toEqual(["news", "general"]);
  });

  it("does not leak the internal position field", () => {
    for (const c of mapChannels(channels, new Set(["text"]))) expect(Object.keys(c).sort()).toEqual(["id", "kind", "name", "parent"]);
  });
});

// null = send no content-type header at all (undefined would trigger the default).
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
