import { describe, expect, it } from "vitest";
import { channelEmbed, isNewAccount, memberJoinEmbed, memberLeaveEmbed, memberRolesEmbed, nicknameEmbed, roleEmbed, voiceEmbed } from "./embeds";

const now = new Date("2026-10-16T12:00:00Z");
const evil = "Bob **bold** <@&999999999999999999> [link](https://x.test)";
const json = (e: { toJSON(): { title?: string; description?: string; fields?: Array<{ name: string; value: string }> } }) => e.toJSON();
const everything = (e: ReturnType<typeof json>) => [e.title, e.description, ...(e.fields ?? []).flatMap((f) => [f.name, f.value])].join("\n");

describe("isNewAccount", () => {
  it("flags accounts younger than a week", () => {
    expect(isNewAccount(new Date(now.getTime() - 86_400_000), now)).toBe(true);
    expect(isNewAccount(new Date(now.getTime() - 8 * 86_400_000), now)).toBe(false);
  });
});

describe("member logs", () => {
  it("shows a join with the account age, and warns about a new account", () => {
    const fresh = json(memberJoinEmbed({ id: "123456789012345678", name: evil, createdAt: new Date(now.getTime() - 3_600_000), memberCount: 99, bot: false, now }));
    expect(fresh.description).toContain("<@123456789012345678>");
    expect(fresh.description).toContain("123456789012345678");
    expect(everything(fresh)).toContain("New account");
    expect(everything(fresh)).not.toMatch(/(?<!\\)<@&/);
    expect(everything(fresh)).toContain("\\*\\*bold\\*\\*");
    const old = json(memberJoinEmbed({ id: "1", name: "x", createdAt: new Date("2020-01-01"), memberCount: 1, bot: true, now }));
    expect(old.title).toBe("Bot added");
    expect(everything(old)).not.toContain("New account");
  });

  it("lists roles on a leave, capped, and copes with an unknown join date", () => {
    const e = json(memberLeaveEmbed({ id: "1", name: "x", joinedAt: null, roleNames: Array.from({ length: 40 }, (_, i) => `Role ${i}`), memberCount: 5 }));
    expect(everything(e)).toContain("unknown");
    expect(everything(e)).toContain("and 25 more");
    expect(everything(memberLeaveEmbed({ id: "1", name: "x", joinedAt: new Date(), roleNames: [], memberCount: 1 }).toJSON())).toContain("none");
  });
});

describe("member updates", () => {
  it("shows nickname and role changes with escaped names", () => {
    const n = json(nicknameEmbed({ id: "1", name: "x", before: null, after: evil }));
    expect(everything(n)).toContain("*none*");
    expect(everything(n)).not.toMatch(/(?<!\\)<@&/);
    const r = json(memberRolesEmbed({ id: "1", name: "x", added: ["A"], removed: ["B", evil] }));
    expect(r.fields!.map((f) => f.name)).toEqual(["Added", "Removed"]);
    expect(json(memberRolesEmbed({ id: "1", name: "x", added: [], removed: ["B"] })).fields!.map((f) => f.name)).toEqual(["Removed"]);
  });
});

describe("voice and server logs", () => {
  it("describes the three voice moves", () => {
    expect(json(voiceEmbed({ id: "1", name: "x", kind: "join", from: null, to: "General" })).title).toBe("Joined a voice channel");
    expect(json(voiceEmbed({ id: "1", name: "x", kind: "leave", from: "General", to: null })).fields!.map((f) => f.name)).toEqual(["From"]);
    expect(json(voiceEmbed({ id: "1", name: "x", kind: "move", from: "A", to: "B" })).fields!.map((f) => f.name)).toEqual(["From", "To"]);
  });

  it("describes channel and role changes", () => {
    expect(json(channelEmbed({ kind: "create", name: evil, type: "text" })).title).toBe("Channel created");
    expect(json(channelEmbed({ kind: "rename", name: "new", before: "old", type: "voice" })).fields!.map((f) => f.name)).toEqual(["Before", "After", "Type"]);
    const role = json(roleEmbed({ kind: "update", name: "New", before: "Old", permissionsChanged: true, colorChanged: true }));
    expect(role.fields!.map((f) => f.name)).toEqual(["Renamed from", "Permissions", "Colour"]);
    expect(json(roleEmbed({ kind: "delete", name: "Gone" })).title).toBe("Role deleted");
  });
});

describe("message log entries", () => {
  const text = (e: { toJSON(): unknown }) => JSON.stringify(e.toJSON());

  it("escape the text, keep line breaks and never contain a live mention", async () => {
    const { messageDeleteEmbed } = await import("./embeds");
    const out = text(messageDeleteEmbed({ channelId: "222222222222222222", messageId: "333333333333333333", author: { id: "111111111111111111", name: "Se*lphy" }, content: "hello **x**\n<@&999999999999999999> @everyone", attachmentNames: ["a_b.png"], sentAt: new Date(0) }));
    expect(out).toContain("hello \\\\*\\\\*x\\\\*\\\\*\\n");
    expect(out).not.toMatch(/(?<!\\)<@&99/);
    expect(out).toContain("a\\\\_b.png");
  });

  it("say so when the old message wasn't remembered", async () => {
    const { messageDeleteEmbed, messageEditEmbed } = await import("./embeds");
    expect(text(messageDeleteEmbed({ channelId: "222222222222222222", messageId: "333333333333333333", author: null, content: null, attachmentNames: [], sentAt: null }))).toContain("weren't saved");
    expect(text(messageEditEmbed({ channelId: "222222222222222222", messageId: "333333333333333333", url: "https://discord.com/channels/1/2/3", author: { id: "111111111111111111", name: "x" }, before: null, after: "new" }))).toContain("not saved");
  });

  it("cut very long text to fit a field", async () => {
    const { messageEditEmbed } = await import("./embeds");
    const e = messageEditEmbed({ channelId: "222222222222222222", messageId: "333333333333333333", url: "https://discord.com/channels/1/2/3", author: { id: "111111111111111111", name: "x" }, before: "y".repeat(5000), after: "z".repeat(5000) }).toJSON();
    for (const f of e.fields ?? []) expect(f.value.length).toBeLessThanOrEqual(1024);
  });
});
