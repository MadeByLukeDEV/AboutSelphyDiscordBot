import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { cardImageProblem, readImageInfo } from "@aboutselphy/shared/image-info";
import type { CardMode } from "@aboutselphy/shared/welcome";
import { ensureFonts, FONT, fitText, hex, roundRect } from "../../lib/canvas";
import { log } from "../../lib/log";

// The welcome card: a picture made for each new member with their avatar, name and member number
// on the image the admin provided. Drawn with @napi-rs/canvas (prebuilt, no system libraries).
// Everything that comes from outside is checked first: the admin's image by its header (type,
// size, pixels), the avatar by host, size and header, and the name is only ever drawn as text.

export const CARD_WIDTH = 1024;
export const CARD_HEIGHT = 360;
export type CardInput = {
  username: string;
  /** The member's avatar picture bytes, or null to draw their initial instead. */
  avatar: Uint8Array | null;
  title: string;
  subtitle: string;
  /** Accent colour as a 24-bit number. */
  color: number;
  mode: CardMode;
  /** The admin's image, already validated, or null for the plain background. */
  image: Uint8Array | null;
};

function cover(ctx: SKRSContext2D, img: Image, w: number, h: number): void {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export async function renderWelcomeCard(input: CardInput): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT);
  const ctx = canvas.getContext("2d");
  const accent = hex(input.color);

  // Re-checked here as well as at upload: never decode something the header check refuses.
  const picture = input.image && cardImageProblem(input.image) === null ? await loadImage(Buffer.from(input.image)).catch(() => null) : null;

  // -- background ----------------------------------------------------------------------
  if (picture && input.mode === "background") {
    cover(ctx, picture, CARD_WIDTH, CARD_HEIGHT);
    // Darken so the text stays readable on any picture.
    const shade = ctx.createLinearGradient(0, 0, CARD_WIDTH, 0);
    shade.addColorStop(0, "rgba(10,12,14,0.86)");
    shade.addColorStop(0.6, "rgba(10,12,14,0.62)");
    shade.addColorStop(1, "rgba(10,12,14,0.35)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  } else {
    const base = ctx.createLinearGradient(0, 0, CARD_WIDTH, CARD_HEIGHT);
    base.addColorStop(0, "#14171b");
    base.addColorStop(1, "#1d2228");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    const glow = ctx.createRadialGradient(CARD_WIDTH * 0.85, CARD_HEIGHT * 0.2, 10, CARD_WIDTH * 0.85, CARD_HEIGHT * 0.2, 420);
    glow.addColorStop(0, `${accent}33`);
    glow.addColorStop(1, `${accent}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  }

  // The admin's picture as a sticker on the right.
  if (picture && input.mode === "sticker") {
    const box = 280;
    const scale = Math.min(box / picture.width, box / picture.height);
    const w = picture.width * scale;
    const h = picture.height * scale;
    const x = CARD_WIDTH - 60 - box / 2 - w / 2;
    const y = (CARD_HEIGHT - h) / 2;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.45)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, x, y, w, h, 20);
    ctx.clip();
    ctx.drawImage(picture, x, y, w, h);
    ctx.restore();
  }

  // Accent bar on the left edge.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, CARD_HEIGHT);

  // -- avatar ----------------------------------------------------------------------------------
  const size = 200;
  const ax = 70;
  const ay = (CARD_HEIGHT - size) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 8, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const avatar = input.avatar && readImageInfo(input.avatar) ? await loadImage(Buffer.from(input.avatar)).catch(() => null) : null;
  if (avatar) {
    ctx.drawImage(avatar, ax, ay, size, size);
  } else {
    ctx.fillStyle = "#2b3138";
    ctx.fillRect(ax, ay, size, size);
    ctx.fillStyle = accent;
    ctx.font = `800 96px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText([...input.username][0]?.toUpperCase() ?? "?", ax + size / 2, ay + size / 2 + 6);
  }
  ctx.restore();

  // -- text -------------------------------------------------------------------------------------
  const tx = ax + size + 56;
  const maxWidth = input.mode === "sticker" && picture ? CARD_WIDTH - tx - 360 : CARD_WIDTH - tx - 60;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = accent;
  ctx.font = `800 30px ${FONT}`;
  ctx.fillText(input.title.toUpperCase(), tx, 138, maxWidth);

  const name = fitText(ctx, input.username, maxWidth, 72, 34, 800);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${name.px}px ${FONT}`;
  ctx.fillText(name.text, tx, 138 + name.px + 8);

  if (input.subtitle) {
    const sub = fitText(ctx, input.subtitle, maxWidth, 32, 20, 700);
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = `700 ${sub.px}px ${FONT}`;
    ctx.fillText(sub.text, tx, 138 + name.px + 8 + sub.px + 18);
  }

  return canvas.toBuffer("image/png");
}

export { fetchAvatar } from "../../lib/avatar";
