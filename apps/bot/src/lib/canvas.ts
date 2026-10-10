import { createRequire } from "node:module";
import { GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";

// Drawing helpers shared by the welcome card and the rank card. The font is bundled (Plus
// Jakarta Sans), so cards look the same on a machine without system fonts.

export const FONT = "BotFont";

let fontsReady = false;
export function ensureFonts(): void {
  if (fontsReady) return;
  const require = createRequire(import.meta.url);
  const dir = require.resolve("@fontsource/plus-jakarta-sans/package.json").replace(/package\.json$/, "files/");
  GlobalFonts.registerFromPath(`${dir}plus-jakarta-sans-latin-700-normal.woff2`, FONT);
  GlobalFonts.registerFromPath(`${dir}plus-jakarta-sans-latin-800-normal.woff2`, FONT);
  fontsReady = true;
}

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

/** Shrinks the font until the text fits, then cuts it with an ellipsis if it still doesn't. */
export function fitText(ctx: SKRSContext2D, text: string, maxWidth: number, startPx: number, minPx: number, weight: number): { text: string; px: number } {
  for (let px = startPx; px >= minPx; px -= 2) {
    ctx.font = `${weight} ${px}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return { text, px };
  }
  ctx.font = `${weight} ${minPx}px ${FONT}`;
  let cut = [...text];
  while (cut.length > 1 && ctx.measureText(`${cut.join("")}…`).width > maxWidth) cut = cut.slice(0, -1);
  return { text: `${cut.join("")}…`, px: minPx };
}

export function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
