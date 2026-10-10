// What kind of picture a file is and how big, read from its first bytes: no decoding. Used before
// an uploaded image is stored (the dashboard) and again before it is drawn (the bot), so a file
// that only claims to be a picture, or is absurdly large in pixels, never reaches a decoder.
// Pure and free of Node APIs. Import it from "@aboutselphy/shared/image-info".

export type ImageInfo = { type: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number };

/** Bounds for the welcome card's picture. */
export const MAX_CARD_IMAGE_BYTES = 3 * 1024 * 1024;
export const MIN_CARD_IMAGE_SIDE = 64;
export const MAX_CARD_IMAGE_SIDE = 4096;

const u16be = (b: Uint8Array, i: number) => ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
const u32be = (b: Uint8Array, i: number) => (((b[i] ?? 0) << 24) | ((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0)) >>> 0;
const u16le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
const u24le = (b: Uint8Array, i: number) => (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...Array.from(b.subarray(i, i + n)));

function png(b: Uint8Array): ImageInfo | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || !signature.every((v, i) => b[i] === v) || ascii(b, 12, 4) !== "IHDR") return null;
  return { type: "image/png", width: u32be(b, 16), height: u32be(b, 20) };
}

function jpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1]!;
    if (marker === 0xff) {
      i++; // padding
      continue;
    }
    // Start-of-frame markers carry the size (C4, C8 and CC are not frames).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { type: "image/jpeg", height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2; // markers without a length
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    i += 2 + length;
  }
  return null;
}

function webp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const kind = ascii(b, 12, 4);
  if (kind === "VP8X") return { type: "image/webp", width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  if (kind === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { type: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (kind === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const [b1, b2, b3, b4] = [b[21]!, b[22]!, b[23]!, b[24]!];
    return { type: "image/webp", width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) };
  }
  return null;
}

/** PNG, JPEG or WebP and its size, or null for anything else (including a truncated or forged header). */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  return png(bytes) ?? jpeg(bytes) ?? webp(bytes);
}

export type CardImageProblem = "type" | "size" | "dimensions";

/** Null when the bytes are a picture the welcome card may use. */
export function cardImageProblem(bytes: Uint8Array): CardImageProblem | null {
  if (bytes.length === 0 || bytes.length > MAX_CARD_IMAGE_BYTES) return "size";
  const info = readImageInfo(bytes);
  if (!info) return "type";
  const ok = (n: number) => n >= MIN_CARD_IMAGE_SIDE && n <= MAX_CARD_IMAGE_SIDE;
  return ok(info.width) && ok(info.height) ? null : "dimensions";
}
