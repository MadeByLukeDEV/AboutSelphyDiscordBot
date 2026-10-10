import { describe, expect, it } from "vitest";
import { announcementInput, isAllowedImageUrl } from "@aboutselphy/shared/announcement";
import { buildAnnouncement, type AnnouncementView } from "./message";

const view = (over: Partial<AnnouncementView> = {}): AnnouncementView => ({
  content: "Hello **everyone**",
  embedEnabled: false,
  embedTitle: "",
  embedDescription: "",
  embedColor: 0x00ffa8,
  embedImageUrl: "",
  pingRoleId: null,
  ...over,
});

describe("buildAnnouncement", () => {
  it("keeps staff markdown but pings nobody without a role, even if @everyone is typed", () => {
    const m = buildAnnouncement(view({ content: "@everyone **big** news" }));
    expect(m.content).toBe("@everyone **big** news");
    expect(m.allowedMentions).toEqual({ parse: [] });
  });

  it("pings only the configured role", () => {
    const m = buildAnnouncement(view({ pingRoleId: "123456789012345678" }));
    expect(m.content.startsWith("<@&123456789012345678> ")).toBe(true);
    expect(m.allowedMentions).toEqual({ parse: [], roles: ["123456789012345678"] });
  });

  it("builds an embed only when it has something to show", () => {
    expect(buildAnnouncement(view({ embedEnabled: true })).embeds).toHaveLength(0);
    const m = buildAnnouncement(view({ embedEnabled: true, embedTitle: "Title", embedDescription: "Body", embedColor: 0xff0000 }));
    const json = m.embeds[0]!.toJSON();
    expect(json.title).toBe("Title");
    expect(json.color).toBe(0xff0000);
  });

  it("drops an image that isn't https and stays inside Discord's limits", () => {
    const bad = buildAnnouncement(view({ embedEnabled: true, embedTitle: "t", embedImageUrl: "http://example.com/a.png" }));
    expect(bad.embeds[0]!.toJSON().image).toBeUndefined();
    const good = buildAnnouncement(view({ embedEnabled: true, embedTitle: "t", embedImageUrl: "https://example.com/a.png" }));
    expect(good.embeds[0]!.toJSON().image?.url).toBe("https://example.com/a.png");
    const long = buildAnnouncement(view({ content: "x".repeat(5000), embedEnabled: true, embedTitle: "y".repeat(500), embedDescription: "z".repeat(9000) }));
    expect(long.content.length).toBeLessThanOrEqual(2000);
    expect(long.embeds[0]!.toJSON().title!.length).toBeLessThanOrEqual(256);
    expect(long.embeds[0]!.toJSON().description!.length).toBeLessThanOrEqual(4000);
  });
});

describe("isAllowedImageUrl", () => {
  it("allows empty and plain https only", () => {
    expect(isAllowedImageUrl("")).toBe(true);
    expect(isAllowedImageUrl("https://cdn.example.com/a.png?x=1")).toBe(true);
    for (const bad of ["http://a.com/x.png", "javascript:alert(1)", "https://user:pw@a.com/x", "ftp://a.com/x", "not a url", "https://a.com/a b", "data:image/png;base64,AAAA"]) {
      expect(isAllowedImageUrl(bad), bad).toBe(false);
    }
  });
});

describe("announcementInput", () => {
  const base = {
    content: "hi",
    embedEnabled: false,
    embedTitle: "",
    embedDescription: "",
    embedColor: 0x00ffa8,
    embedImageUrl: "",
    channelId: "123456789012345678",
    pingRoleId: "",
    mode: "now" as const,
  };
  const parse = (over: Record<string, unknown>) => announcementInput.safeParse({ ...base, ...over });

  it("needs something to say", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ content: "  " }).success).toBe(false);
    expect(parse({ content: "", embedEnabled: true, embedTitle: "t" }).success).toBe(true);
    expect(parse({ content: "", embedEnabled: false, embedTitle: "t" }).success).toBe(false);
  });

  it("checks the schedule", () => {
    const inAnHour = new Date(Date.now() + 3_600_000).toISOString();
    expect(parse({ mode: "schedule", scheduledFor: inAnHour }).success).toBe(true);
    expect(parse({ mode: "schedule" }).success).toBe(false);
    expect(parse({ mode: "schedule", scheduledFor: "soon" }).success).toBe(false);
    expect(parse({ mode: "schedule", scheduledFor: new Date(Date.now() + 5_000).toISOString() }).success).toBe(false);
    expect(parse({ mode: "schedule", scheduledFor: new Date(Date.now() + 400 * 86_400_000).toISOString() }).success).toBe(false);
  });

  it("refuses bad ids and images", () => {
    expect(parse({ channelId: "abc" }).success).toBe(false);
    expect(parse({ pingRoleId: "everyone" }).success).toBe(false);
    expect(parse({ embedImageUrl: "http://a.com/x.png" }).success).toBe(false);
  });
});
