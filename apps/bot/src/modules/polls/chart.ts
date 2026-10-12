import { createCanvas } from "@napi-rs/canvas";
import { ensureFonts, FONT, fitText, hex, roundRect } from "../../lib/canvas";
import type { ChartRow } from "./rules";

// The results chart posted when a poll ends: one bar per option, the leader(s) in the brand colour.

const WIDTH = 900;
const ROW = 58;
const TOP = 96;
const BRAND = 0x00ffa8;

export async function renderPollChart(question: string, rows: readonly ChartRow[], voters: number): Promise<Buffer> {
  ensureFonts();
  const height = TOP + rows.length * ROW + 28;
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
  return canvas.toBuffer("image/png");
}
