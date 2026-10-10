import { describe, expect, it } from "vitest";
import { createCanvas } from "@napi-rs/canvas";
import { readImageInfo } from "@aboutselphy/shared/image-info";
import { CARD_HEIGHT, CARD_WIDTH, fetchAvatar, renderWelcomeCard, type CardInput } from "./card";

const picture = (w: number, h: number, color: string) => {
  const c = createCanvas(w, h);
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.fillRect(0, 0, w, h);
  return new Uint8Array(c.toBuffer("image/png"));
};

const base: CardInput = { username: "NewMember", avatar: null, title: "Welcome", subtitle: "Member #1234", color: 0x00ffa8, mode: "background", image: null };

describe("renderWelcomeCard", () => {
  it("makes a PNG of the card's size with and without the admin's image or an avatar", async () => {
    for (const input of [base, { ...base, image: picture(800, 300, "#884400") }, { ...base, mode: "sticker" as const, image: picture(300, 300, "#0044aa"), avatar: picture(128, 128, "#aa0044") }]) {
      const png = await renderWelcomeCard(input);
      expect(readImageInfo(png)).toEqual({ type: "image/png", width: CARD_WIDTH, height: CARD_HEIGHT });
    }
  });

  it("copes with very long names, emoji and empty subtitles", async () => {
    const png = await renderWelcomeCard({ ...base, username: "W".repeat(200) + " 🎮", subtitle: "" });
    expect(readImageInfo(png)?.width).toBe(CARD_WIDTH);
  });

  it("ignores an image that fails the header check instead of decoding it", async () => {
    const png = await renderWelcomeCard({ ...base, image: new Uint8Array([1, 2, 3, 4]) });
    expect(readImageInfo(png)?.width).toBe(CARD_WIDTH);
  });
});

describe("fetchAvatar", () => {
  it("only talks to Discord's CDN over https", async () => {
    expect(await fetchAvatar("http://cdn.discordapp.com/avatars/1/a.png")).toBeNull();
    expect(await fetchAvatar("https://evil.example/a.png")).toBeNull();
    expect(await fetchAvatar("https://cdn.discordapp.com.evil.example/a.png")).toBeNull();
    expect(await fetchAvatar("not a url")).toBeNull();
  });
});
