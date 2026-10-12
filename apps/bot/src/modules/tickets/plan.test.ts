import { OverwriteType, PermissionFlagsBits as P } from "discord.js";
import { describe, expect, it } from "vitest";
import { fillTicketTemplate, ticketChannelName, ticketSettingsSchema, transcriptSchema } from "@aboutselphy/shared/tickets";
import { buildTranscript, canClaim, canClose, cleanReason, idleCutoff, modalControlId, OPEN_CONTROL_ID, openCategoryControlId, parentFor, rateControlId, staffRolesFor, starsText, parseTicketControl, ticketControlId, ticketOverwrites, transcriptToText, type RawMessage } from "./plan";

describe("ticketOverwrites", () => {
  const specs = ticketOverwrites({ everyoneId: "E", openerId: "O", botId: "B", staffRoleIds: ["S1", "S2"] });
  const of = (id: string) => specs.find((s) => s.id === id)!;

  it("hides the channel from everyone and shows it to the opener, staff and the bot", () => {
    expect(of("E").deny).toContain(P.ViewChannel);
    expect(of("E").allow).toEqual([]);
    for (const id of ["O", "S1", "S2", "B"]) expect(of(id).allow).toContain(P.ViewChannel);
    expect(of("O").type).toBe(OverwriteType.Member);
    expect(of("S1").type).toBe(OverwriteType.Role);
  });

  it("never gives the opener any power over the channel or other people's messages", () => {
    for (const bad of [P.ManageChannels, P.ManageMessages, P.ManageRoles, P.MentionEveryone]) expect(of("O").allow).not.toContain(bad);
    expect(of("S1").allow).toContain(P.ManageMessages);
    expect(of("B").allow).toContain(P.ManageChannels);
  });
});

describe("who may do what", () => {
  it("lets the opener or staff close, and only staff claim", () => {
    expect(canClose({ isStaff: false, isOpener: true })).toBe(true);
    expect(canClose({ isStaff: true, isOpener: false })).toBe(true);
    expect(canClose({ isStaff: false, isOpener: false })).toBe(false);
    expect(canClaim({ isStaff: false, isOpener: true })).toBe(false);
    expect(canClaim({ isStaff: true, isOpener: false })).toBe(true);
  });
});

describe("control ids", () => {
  it("round-trips and rejects anything else", () => {
    expect(parseTicketControl(OPEN_CONTROL_ID)).toEqual({ action: "open" });
    expect(parseTicketControl(ticketControlId("close", "cm1abc2def3ghi"))).toEqual({ action: "close", ticketId: "cm1abc2def3ghi" });
    expect(parseTicketControl(ticketControlId("claim", "cm1abc2def3ghi"))).toEqual({ action: "claim", ticketId: "cm1abc2def3ghi" });
    for (const bad of ["tk:", "tk:open:x", "tk:close:short", "tk:delete:cm1abc2def3ghi", "rp:cm1abc2def3ghi", "tk:close:CM1ABC2DEF3GHI", "tk:close:cm1abc2def3ghi:x"]) {
      expect(parseTicketControl(bad), bad).toBeNull();
    }
  });
});

describe("transcript", () => {
  const msg = (n: number, over: Partial<RawMessage> = {}): RawMessage => ({
    id: String(n),
    authorId: "1",
    authorName: "Bob",
    authorBot: false,
    at: new Date(Date.UTC(2026, 9, 17, 10, n)),
    content: `hello ${n}`,
    attachments: [],
    embeds: 0,
    ...over,
  });

  it("is ordered oldest first, valid against the schema, and keeps only Discord CDN links", () => {
    const t = buildTranscript([
      msg(2, { attachments: [{ name: "a.png", url: "https://cdn.discordapp.com/attachments/1/2/a.png" }, { name: "evil", url: "https://evil.example/x" }, { name: "js", url: "javascript:alert(1)" }] }),
      msg(1),
    ]);
    expect(t.messages.map((m) => m.id)).toEqual(["1", "2"]);
    expect(t.messages[1]!.attachments).toEqual([{ name: "a.png", url: "https://cdn.discordapp.com/attachments/1/2/a.png" }]);
    expect(transcriptSchema.safeParse(t).success).toBe(true);
    expect(t.truncated).toBe(false);
  });

  it("cuts a huge conversation and an enormous message, and says so", () => {
    const many = Array.from({ length: 2100 }, (_, i) => msg(i + 1));
    const t = buildTranscript(many, 2100);
    expect(t.messages).toHaveLength(2000);
    expect(t.truncated).toBe(true);
    expect(t.messages[0]!.id).toBe("101"); // the oldest were dropped
    expect(buildTranscript([msg(1, { content: "x".repeat(9000) })]).messages[0]!.content).toHaveLength(4000);
  });

  it("renders as text with bots, files and embeds marked", () => {
    const text = transcriptToText(buildTranscript([msg(1), msg(2, { authorBot: true, embeds: 1, attachments: [{ name: "a.png", url: "https://cdn.discordapp.com/a.png" }] })]), "Ticket #1");
    expect(text).toContain("Ticket #1");
    expect(text).toContain("[2026-10-17 10:01:00] Bob: hello 1");
    expect(text).toContain("Bob (bot): hello 2 [a.png: https://cdn.discordapp.com/a.png] [1 embed]");
  });
});

describe("helpers and settings", () => {
  it("names channels and fills the template", () => {
    expect(ticketChannelName(7)).toBe("ticket-0007");
    expect(ticketChannelName(12345)).toBe("ticket-12345");
    expect(fillTicketTemplate("Hi {user} #{number} {x}", { user: "<@1>", number: "7" })).toBe("Hi <@1> #7 {x}");
  });

  const base = {
    enabled: false,
    panelChannelId: "",
    categoryId: "",
    logChannelId: "",
    staffRoleIds: [],
    maxOpenPerUser: 1,
    askReason: false,
    askRating: false,
    autoCloseHours: 0,
    panelTitle: "Help",
    panelDescription: "",
    panelColor: 0,
    buttonLabel: "Open",
    welcomeTemplate: "Hi {user}",
  };
  const parse = (over: Record<string, unknown>) => ticketSettingsSchema.safeParse({ ...base, ...over });

  it("needs a panel channel, a category and a staff role before it can be switched on", () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ enabled: true }).success).toBe(false);
    expect(parse({ enabled: true, panelChannelId: "123456789012345678", categoryId: "123456789012345679", staffRoleIds: ["123456789012345680"] }).success).toBe(true);
  });

  it("limits staff roles and open tickets", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `1234567890123456${String(i).padStart(2, "0")}`);
    expect(parse({ staffRoleIds: ids(5) }).success).toBe(true);
    expect(parse({ staffRoleIds: ids(6) }).success).toBe(false);
    expect(parse({ staffRoleIds: [ids(1)[0], ids(1)[0]] }).success).toBe(false);
    expect(parse({ maxOpenPerUser: 0 }).success).toBe(false);
    expect(parse({ maxOpenPerUser: 6 }).success).toBe(false);
    expect(parse({ autoCloseHours: 721 }).success).toBe(false);
    expect(parse({ autoCloseHours: -1 }).success).toBe(false);
    expect(parse({ autoCloseHours: 48, askReason: true }).success).toBe(true);
  });
});

describe("idle tickets and the reason form", () => {
  const now = new Date("2026-11-01T12:00:00Z");
  it("idleCutoff is off at 0 and counts hours back otherwise", () => {
    expect(idleCutoff(0, now)).toBeNull();
    expect(idleCutoff(-1, now)).toBeNull();
    expect(idleCutoff(24, now)).toEqual(new Date("2026-10-31T12:00:00Z"));
  });
  it("cleanReason trims, collapses blank lines and cuts", () => {
    expect(cleanReason("  help\r\n\r\n\r\n\r\nplease  ")).toBe("help\n\nplease");
    expect(cleanReason("x".repeat(900))).toHaveLength(300);
    expect(cleanReason(null)).toBe("");
  });
  it("parses the form's id and rejects look-alikes", () => {
    expect(parseTicketControl("tk:modal")).toEqual({ action: "modal" });
    expect(parseTicketControl("tk:modal:x")).toBeNull();
    expect(parseTicketControl("tk:open")).toEqual({ action: "open" });
  });
});

describe("categories and ratings", () => {
  it("a category's own roles replace the general ones, an empty list falls back", () => {
    expect(staffRolesFor(["a", "b"], { staffRoleIds: ["c"] })).toEqual(["c"]);
    expect(staffRolesFor(["a", "b"], { staffRoleIds: [] })).toEqual(["a", "b"]);
    expect(staffRolesFor(["a"], null)).toEqual(["a"]);
  });
  it("a category's own Discord category wins, else the general one", () => {
    expect(parentFor("g", { discordCategoryId: "x" })).toBe("x");
    expect(parentFor("g", { discordCategoryId: null })).toBe("g");
    expect(parentFor(null, null)).toBeNull();
  });
  it("parses the category buttons, the category form and the rating buttons strictly", () => {
    expect(parseTicketControl("tk:open:abcdefghij12")).toEqual({ action: "open", categoryId: "abcdefghij12" });
    expect(parseTicketControl("tk:modal:abcdefghij12")).toEqual({ action: "modal", categoryId: "abcdefghij12" });
    expect(parseTicketControl("tk:rate:abcdefghij12:5")).toEqual({ action: "rate", ticketId: "abcdefghij12", stars: 5 });
    for (const bad of ["tk:rate:abcdefghij12:0", "tk:rate:abcdefghij12:6", "tk:rate:short:3", "tk:open:Bad Id", "tk:rate:abcdefghij12:3:x"]) expect(parseTicketControl(bad), bad).toBeNull();
  });
  it("round-trips the ids it builds", () => {
    expect(parseTicketControl(openCategoryControlId("abcdefghij12"))).toEqual({ action: "open", categoryId: "abcdefghij12" });
    expect(parseTicketControl(rateControlId("abcdefghij12", 4))).toEqual({ action: "rate", ticketId: "abcdefghij12", stars: 4 });
    expect(parseTicketControl(modalControlId(null))).toEqual({ action: "modal" });
  });
  it("shows stars as text", () => {
    expect(starsText(3)).toBe("★★★☆☆");
    expect(starsText(9)).toBe("★★★★★");
    expect(starsText(-1)).toBe("☆☆☆☆☆");
  });
});
