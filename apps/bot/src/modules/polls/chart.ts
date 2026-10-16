import { createCanvas } from "@napi-rs/canvas";
import { ensureFonts, FONT, fitText, hex, roundRect } from "../../lib/canvas";
import type { ChartRow, Timeline } from "./rules";

// The results chart posted when a poll ends: one bar per option, the leader(s) in the brand colour.

const WIDTH = 900;
const ROW = 58;
const TOP = 96;
const BRAND = 0x00ffa8;

const TIMELINE_H = 230;

export async function renderPollChart(question: string, rows: readonly ChartRow[], voters: number, timeline: Timeline | null = null): Promise<Buffer> {
  ensureFonts();
  const barsEnd = TOP + rows.length * ROW;
  const height = barsEnd + 28 + (timeline ? TIMELINE_H : 0);
  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#14171b";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = hex(BRAND);
  ctx.fillRect(0, 0, 10, height);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#f2f3f5";
  const title = fitText(ctx, question, WIDTH - 90, 32, 20, 800);
  ctx.font = `800 ${title.px}px ${FONT}`;
  ctx.fillText(title.text, 44, 50);
  ctx.fillStyle = "#949ba4";
  ctx.font = `700 18px ${FONT}`;
  ctx.fillText(`${voters} ${voters === 1 ? "voter" : "voters"}`, 44, 78);

  const barX = 44;
  const barW = WIDTH - 44 - 44;
  rows.forEach((row, i) => {
    const y = TOP + i * ROW;
    ctx.fillStyle = "#e6e7ea";
    const label = fitText(ctx, row.label, barW - 150, 20, 14, 700);
    ctx.font = `700 ${label.px}px ${FONT}`;
    ctx.fillText(label.text, barX, y + 16);
    ctx.textAlign = "right";
    ctx.fillStyle = row.winner ? hex(BRAND) : "#949ba4";
    ctx.font = `800 18px ${FONT}`;
    ctx.fillText(`${row.count} · ${row.percent}%`, barX + barW, y + 16);
    ctx.textAlign = "left";
    ctx.fillStyle = "#2b3138";
    roundRect(ctx, barX, y + 26, barW, 16, 8);
    ctx.fill();
    if (row.percent > 0) {
      ctx.fillStyle = row.winner ? hex(BRAND) : "#5865f2";
      roundRect(ctx, barX, y + 26, Math.max(16, (barW * row.percent) / 100), 16, 8);
      ctx.fill();
    }
  });
  if (timeline) drawTimeline(ctx, timeline, barX, barsEnd + 14, barW, TIMELINE_H - 40);
  return canvas.toBuffer("image/png");
}

/** A line of how many people had voted over the poll's life, with the start and end dates under it. */
function drawTimeline(ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>, t: Timeline, x: number, y: number, w: number, h: number): void {
  const top = y + 30;
  const bottom = y + h - 18;
  const max = Math.max(1, t.points[t.points.length - 1] ?? 1);
  ctx.textAlign = "left";
  ctx.fillStyle = "#949ba4";
  ctx.font = `700 16px ${FONT}`;
  ctx.fillText("Voters over time", x, y + 14);
  ctx.strokeStyle = "#2b3138";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  ctx.lineTo(x + w, bottom);
  ctx.stroke();
  const step = w / Math.max(1, t.points.length - 1);
  const py = (v: number) => bottom - ((bottom - top) * v) / max;
  ctx.beginPath();
  ctx.moveTo(x, bottom);
  t.points.forEach((v, i) => ctx.lineTo(x + i * step, py(v)));
  ctx.lineTo(x + w, bottom);
  ctx.closePath();
  ctx.fillStyle = "rgba(0, 255, 168, 0.18)";
  ctx.fill();
  ctx.beginPath();
  t.points.forEach((v, i) => (i === 0 ? ctx.moveTo(x, py(v)) : ctx.lineTo(x + i * step, py(v))));
  ctx.strokeStyle = hex(BRAND);
  ctx.lineWidth = 3;
  ctx.stroke();
  const date = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  ctx.fillStyle = "#949ba4";
  ctx.font = `600 14px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText(date(t.start), x, bottom + 16);
  ctx.textAlign = "right";
  ctx.fillText(date(t.end), x + w, bottom + 16);
  ctx.fillText(String(max), x + w, y + 14);
  ctx.textAlign = "left";
}
