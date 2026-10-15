import { createCanvas, loadImage, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { cardImageProblem } from "@aboutselphy/shared/image-info";
import { ensureFonts, FONT, fitText, roundRect } from "../../lib/canvas";
import { log } from "../../lib/log";

// The pictures the bot draws for events: a drop card (the items with their pictures), an event card, and the monthly overview. Each game has its
// own accent colour and an optional background picture. Everything is drawn from plain data; item and background pictures were checked by their
// header when they were uploaded and are checked again here before they are decoded. Drawn with @napi-rs/canvas and the bundled font.

export const CARD_WIDTH = 1100;
const PAD = 48;
const MAX_ITEMS = 12;
const MAX_ROWS = 14;

export type CardTheme = { accent: string; background: Buffer | null };
export type CardItem = { name: string; image: Buffer | null };

const KIND_LABEL: Record<string, string> = { drop: "DROPS", event: "EVENT", update: "UPDATE", sale: "SALE", other: "NEWS" };
export const kindLabel = (kind: string): string => KIND_LABEL[kind] ?? "EVENT";

const SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Oct 23 – Oct 26, 2026", "Oct 23, 2026", or with a UTC time for events that have one. */
export function dateRangeText(start: Date, end: Date | null, allDay: boolean): string {
  const day = (d: Date) => Math.floor(d.getTime() / 86_400_000);
  // A date-only range ends on its last day itself; a timed range ends when the clock says (so its last day is the one before midnight).
  const last = end ? (allDay ? end : new Date(end.getTime() - 1)) : null;
  if (last && day(last) > day(start)) return `${SHORT.format(start)} – ${LONG.format(last)}`;
  return allDay ? LONG.format(start) : `${LONG.format(start)} · ${TIME.format(start)} UTC`;
}

export const weeklyText = (weekday: number): string => `Every ${WEEKDAYS[weekday] ?? "week"}`;

/** Breaks text into at most `maxLines` lines that fit `maxWidth` (measured by `measure`); the last line ends with an ellipsis if text was cut. */
export function wrapLines(measure: (text: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const push = (l: string) => lines.push(l);
  for (let i = 0; i < words.length; i++) {
    let word = words[i]!;
    // A single word wider than the line is cut into pieces.
    while (measure(word) > maxWidth && [...word].length > 1) {
      let cut = [...word];
      while (cut.length > 1 && measure(cut.join("")) > maxWidth) cut = cut.slice(0, -1);
      if (line) {
        push(line);
        line = "";
      }
      push(cut.join(""));
      word = word.slice(cut.join("").length);
      if (lines.length >= maxLines) break;
    }
    if (lines.length >= maxLines) break;
    const next = line ? `${line} ${word}` : word;
    if (measure(next) <= maxWidth) line = next;
    else {
      if (line) push(line);
      line = word;
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) push(line);
  const used = lines.join(" ").length;
  const truncated = lines.length > maxLines || used < words.join(" ").length - 1;
  const out = lines.slice(0, maxLines);
  if (truncated && out.length > 0) {
    let last = [...out[out.length - 1]!];
    while (last.length > 1 && measure(`${last.join("")}…`) > maxWidth) last = last.slice(0, -1);
    out[out.length - 1] = `${last.join("")}…`;
  }
  return out;
}

async function decode(bytes: Buffer | null): Promise<Image | null> {
  if (!bytes || cardImageProblem(bytes) !== null) return null;
  return loadImage(bytes).catch(() => null);
}

function cover(ctx: SKRSContext2D, img: Image, w: number, h: number): void {
  const scale = Math.max(w / img.width, h / img.height);
  ctx.drawImage(img, (w - img.width * scale) / 2, (h - img.height * scale) / 2, img.width * scale, img.height * scale);
}

function contain(ctx: SKRSContext2D, img: Image, x: number, y: number, w: number, h: number): void {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

async function paintBackground(ctx: SKRSContext2D, w: number, h: number, theme: CardTheme): Promise<void> {
  const picture = await decode(theme.background);
  if (picture) {
    cover(ctx, picture, w, h);
    const shade = ctx.createLinearGradient(0, 0, 0, h);
    shade.addColorStop(0, "rgba(9,11,15,0.78)");
    shade.addColorStop(1, "rgba(9,11,15,0.92)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#10131a");
  base.addColorStop(1, "#1a1f2b");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const glow = ctx.createRadialGradient(w * 0.88, 0, 20, w * 0.88, 0, Math.max(w, h) * 0.7);
  glow.addColorStop(0, `${theme.accent}40`);
  glow.addColorStop(1, `${theme.accent}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);
}

function chip(ctx: SKRSContext2D, text: string, x: number, y: number, accent: string): number {
  ctx.font = `800 20px ${FONT}`;
  const w = ctx.measureText(text).width + 32;
  ctx.fillStyle = `${accent}2e`;
  roundRect(ctx, x, y, w, 38, 19);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 16, y + 20);
  ctx.textBaseline = "alphabetic";
  return w;
}

export type EventCardInput = { title: string; kind: string; dateText: string; summary: string; items: CardItem[]; theme: CardTheme };

const measureWith = (ctx: SKRSContext2D, font: string) => (t: string) => {
  ctx.font = font;
  return ctx.measureText(t).width;
};

/** The layout of an event card: how tall it is and where the item grid starts. Separate from the drawing so it can be tested. */
export function eventCardLayout(itemCount: number, summaryLines: number, titleLines: number): { height: number; gridTop: number; cols: number; cellW: number; cellH: number; rows: number } {
  const shown = Math.min(itemCount, MAX_ITEMS);
  const cols = shown <= 3 ? Math.max(shown, 1) : 4;
  const gap = 20;
  const cellW = Math.floor((CARD_WIDTH - PAD * 2 - gap * (cols - 1)) / cols);
  const cellH = shown === 0 ? 0 : Math.min(cellW, 250) + 74;
  const rows = shown === 0 ? 0 : Math.ceil(shown / cols);
  // Mirrors the drawing: chip, title lines, date line, summary lines, then a gap.
  const gridTop = PAD + 142 + titleLines * 66 + (summaryLines > 0 ? 14 + summaryLines * 36 : 0) + 28;
  const height = gridTop + (rows > 0 ? rows * cellH + (rows - 1) * gap : 0) + PAD;
  return { height: Math.max(height, 300), gridTop, cols, cellW, cellH, rows };
}

export async function renderEventCard(input: EventCardInput): Promise<Buffer> {
  ensureFonts();
  const measure = createCanvas(10, 10).getContext("2d");
  const innerW = CARD_WIDTH - PAD * 2;
  const titleLines = wrapLines(measureWith(measure, `800 54px ${FONT}`), input.title, innerW, 2);
  const summaryLines = input.summary ? wrapLines(measureWith(measure, `700 24px ${FONT}`), input.summary, innerW, 3) : [];
  const layout = eventCardLayout(input.items.length, summaryLines.length, titleLines.length);

  const canvas = createCanvas(CARD_WIDTH, layout.height);
  const ctx = canvas.getContext("2d");
  await paintBackground(ctx, CARD_WIDTH, layout.height, input.theme);

  let y = PAD;
  chip(ctx, kindLabel(input.kind), PAD, y, input.theme.accent);
  y += 56 + 54;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 54px ${FONT}`;
  for (const line of titleLines) {
    ctx.fillText(line, PAD, y);
    y += 66;
  }
  y -= 12;
  ctx.fillStyle = input.theme.accent;
  const date = fitText(ctx, input.dateText, innerW, 30, 20, 800);
  ctx.font = `800 ${date.px}px ${FONT}`;
  ctx.fillText(date.text, PAD, y + 20);
  y += 44;
  if (summaryLines.length > 0) {
    ctx.fillStyle = "#c4cad6";
    ctx.font = `700 24px ${FONT}`;
    y += 14;
    for (const line of summaryLines) {
      y += 36;
      ctx.fillText(line, PAD, y - 8);
    }
  }

  // The items, each on its own tile with its picture (or its initials when none was uploaded).
  const shown = input.items.slice(0, MAX_ITEMS);
  const extra = input.items.length - shown.length;
  const gap = 20;
  for (let i = 0; i < shown.length; i++) {
    const item = shown[i]!;
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const x = PAD + col * (layout.cellW + gap);
    const top = layout.gridTop + row * (layout.cellH + gap);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, x, top, layout.cellW, layout.cellH, 20);
    ctx.fill();
    ctx.strokeStyle = `${input.theme.accent}55`;
    ctx.lineWidth = 2;
    roundRect(ctx, x, top, layout.cellW, layout.cellH, 20);
    ctx.stroke();

    const artH = layout.cellH - 74;
    const picture = await decode(item.image);
    if (picture) {
      contain(ctx, picture, x + 14, top + 14, layout.cellW - 28, artH - 14);
    } else {
      const s = Math.min(layout.cellW - 60, artH - 30);
      const gx = x + (layout.cellW - s) / 2;
      const gy = top + 18 + (artH - 18 - s) / 2;
      const g = ctx.createLinearGradient(gx, gy, gx + s, gy + s);
      g.addColorStop(0, `${input.theme.accent}55`);
      g.addColorStop(1, `${input.theme.accent}11`);
      ctx.fillStyle = g;
      roundRect(ctx, gx, gy, s, s, 18);
      ctx.fill();
      const initials = item.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => [...w][0]!.toUpperCase()).join("");
      ctx.fillStyle = input.theme.accent;
      ctx.font = `800 ${Math.floor(s * 0.38)}px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initials || "?", gx + s / 2, gy + s / 2);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
    const label = i === shown.length - 1 && extra > 0 ? `${item.name} (+${extra} more)` : item.name;
    const nameLines = wrapLines(measureWith(ctx, `800 22px ${FONT}`), label, layout.cellW - 28, 2);
    ctx.fillStyle = "#f4f6fa";
    ctx.font = `800 22px ${FONT}`;
    nameLines.forEach((l, n) => ctx.fillText(l, x + 16, top + layout.cellH - 40 + n * 26));
  }

  return canvas.toBuffer("image/png");
}

export type MonthlyCardRow = { title: string; when: string; kind: string; blurb: string };
export type MonthlyCardInput = { title: string; subtitle: string; rows: MonthlyCardRow[]; theme: CardTheme };

const ROW_H = 92;

export async function renderMonthlyCard(input: MonthlyCardInput): Promise<Buffer> {
  ensureFonts();
  const shown = input.rows.slice(0, MAX_ROWS);
  const more = input.rows.length - shown.length;
  const top = PAD + 130;
  const height = top + Math.max(shown.length, 1) * ROW_H + (more > 0 ? 50 : 0) + PAD - 10;
  const canvas = createCanvas(CARD_WIDTH, height);
  const ctx = canvas.getContext("2d");
  await paintBackground(ctx, CARD_WIDTH, height, input.theme);

  ctx.fillStyle = input.theme.accent;
  ctx.font = `800 24px ${FONT}`;
  ctx.fillText(input.subtitle.toUpperCase(), PAD, PAD + 28);
  ctx.fillStyle = "#ffffff";
  const head = fitText(ctx, input.title, CARD_WIDTH - PAD * 2, 64, 36, 800);
  ctx.font = `800 ${head.px}px ${FONT}`;
  ctx.fillText(head.text, PAD, PAD + 96);

  const measure = createCanvas(10, 10).getContext("2d");
  shown.forEach((row, i) => {
    const y = top + i * ROW_H;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    roundRect(ctx, PAD, y, CARD_WIDTH - PAD * 2, ROW_H - 12, 16);
    ctx.fill();
    ctx.fillStyle = input.theme.accent;
    roundRect(ctx, PAD, y, 8, ROW_H - 12, 4);
    ctx.fill();
    const whenW = (() => {
      measure.font = `800 22px ${FONT}`;
      return measure.measureText(row.when).width;
    })();
    ctx.fillStyle = "#ffffff";
    const title = fitText(ctx, `${row.title}`, CARD_WIDTH - PAD * 2 - whenW - 90, 28, 20, 800);
    ctx.font = `800 ${title.px}px ${FONT}`;
    ctx.fillText(title.text, PAD + 28, y + 32);
    ctx.fillStyle = input.theme.accent;
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(row.when, CARD_WIDTH - PAD - 20, y + 32);
    ctx.textAlign = "left";
    if (row.blurb) {
      ctx.fillStyle = "#b9c0cc";
      const blurb = fitText(ctx, row.blurb, CARD_WIDTH - PAD * 2 - 60, 22, 16, 700);
      ctx.font = `700 ${blurb.px}px ${FONT}`;
      ctx.fillText(blurb.text, PAD + 28, y + 62);
    }
  });
  if (more > 0) {
    ctx.fillStyle = "#b9c0cc";
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`… and ${more} more`, PAD + 28, top + shown.length * ROW_H + 24);
  }
  return canvas.toBuffer("image/png");
}

/** A drawing failure never stops a post: it is logged and the post goes out without the picture. */
export async function tryDraw(what: string, draw: () => Promise<Buffer>): Promise<Buffer | null> {
  try {
    return await draw();
  } catch (err) {
    log.warn({ err: err instanceof Error ? err.message : "error", what }, "eventcal: could not draw the picture");
    return null;
  }
}
