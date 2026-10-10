import { describe, expect, it } from "vitest";
import { cardImageProblem, MAX_CARD_IMAGE_BYTES, readImageInfo } from "@aboutselphy/shared/image-info";

const bytes = (...parts: Array<number[] | string>) => Uint8Array.from(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

const png = (w: number, h: number) => bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(w), be32(h), [8, 6, 0, 0, 0]);
const jpeg = (w: number, h: number) => bytes([0xff, 0xd8], [0xff, 0xe0], be16(16), new Array(14).fill(0), [0xff, 0xc0], be16(17), [8], be16(h), be16(w), [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const webpX = (w: number, h: number) => bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], [0, 0, 0, 0], le24(w - 1), le24(h - 1));
const webpLossy = (w: number, h: number) => bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8 ", [10, 0, 0, 0], [0, 0, 0], [0x9d, 0x01, 0x2a], le16(w), le16(h));

describe("readImageInfo", () => {
  it("reads PNG, JPEG and WebP sizes", () => {
    expect(readImageInfo(png(1024, 400))).toEqual({ type: "image/png", width: 1024, height: 400 });
    expect(readImageInfo(jpeg(800, 600))).toEqual({ type: "image/jpeg", width: 800, height: 600 });
    expect(readImageInfo(webpX(640, 360))).toEqual({ type: "image/webp", width: 640, height: 360 });
    expect(readImageInfo(webpLossy(500, 250))).toEqual({ type: "image/webp", width: 500, height: 250 });
  });

  it("refuses anything that only looks like a picture", () => {
    expect(readImageInfo(bytes("GIF89a", new Array(30).fill(0)))).toBeNull();
    expect(readImageInfo(bytes("<svg xmlns='http://www.w3.org/2000/svg'></svg>"))).toBeNull();
    expect(readImageInfo(bytes("MZ", new Array(40).fill(0)))).toBeNull();
    expect(readImageInfo(new Uint8Array(0))).toBeNull();
    expect(readImageInfo(png(10, 10).subarray(0, 12))).toBeNull(); // truncated
  });
});

describe("cardImageProblem", () => {
  it("accepts a normal picture", () => {
    expect(cardImageProblem(png(1024, 400))).toBeNull();
  });

  it("rejects wrong types, tiny and huge pictures, and files that are too big", () => {
    expect(cardImageProblem(bytes("not an image at all, just text"))).toBe("type");
    expect(cardImageProblem(png(10, 10))).toBe("dimensions");
    expect(cardImageProblem(png(5000, 5000))).toBe("dimensions");
    expect(cardImageProblem(png(100_000, 100_000))).toBe("dimensions");
    expect(cardImageProblem(new Uint8Array(0))).toBe("size");
    expect(cardImageProblem(new Uint8Array(MAX_CARD_IMAGE_BYTES + 1))).toBe("size");
  });
});
