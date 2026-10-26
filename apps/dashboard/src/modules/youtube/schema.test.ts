import { describe, expect, it } from "vitest";
import { parseYoutubeChannelId } from "./schema";

const ID = "UCabcdefghijklmnopqrstuv";

describe("parseYoutubeChannelId", () => {
  it("takes a bare ID or one inside a channel link", () => {
    expect(parseYoutubeChannelId(ID)).toBe(ID);
    expect(parseYoutubeChannelId(`https://www.youtube.com/channel/${ID}`)).toBe(ID);
    expect(parseYoutubeChannelId(`https://www.youtube.com/channel/${ID}/videos?x=1`)).toBe(ID);
  });
  it("refuses handles, short IDs and IDs that are part of a longer word", () => {
    expect(parseYoutubeChannelId("@someone")).toBeNull();
    expect(parseYoutubeChannelId("UCshort")).toBeNull();
    expect(parseYoutubeChannelId(`${ID}extra`)).toBeNull();
    expect(parseYoutubeChannelId(`xUC${ID.slice(2)}`)).toBeNull();
  });
});
