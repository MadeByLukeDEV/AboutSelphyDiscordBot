import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readImageInfo } from "@aboutselphy/shared/image-info";
import { ensureFonts, FONT, fitText, hex, roundRect } from "../../lib/canvas";

// The /rank picture: avatar, name, rank, level and a progress bar. Same drawing approach as the
// welcome card; the avatar is checked by its header before it is decoded.

export const RANK_WIDTH = 934;
export const RANK_HEIGHT = 282;

export type RankCardInput = {
  username: string;
  avatar: Uint8Array | null;
  rank: number;
  level: number;
  /** XP gathered towards the next level, and what the next level takes. */
  into: number;
  needed: number;
  percent: number;
  totalXp: number;
  color: number;
};

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 10_000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export async function renderRankCard(input: RankCardInput): Promise<Buffer> {
  ensureFonts();
  const canvas = createCanvas(RANK_WIDTH, RANK_HEIGHT);
  const ctx = canvas.getContext("2d");
  const accent = hex(input.color);

  const bg = ctx.createLinearGradient(0, 0, RANK_WIDTH, RANK_HEIGHT);
  bg.addColorStop(0, "#14171b");
  bg.addColorStop(1, "#1d2228");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, RANK_WIDTH, RANK_HEIGHT);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 10, RANK_HEIGHT);

  // Avatar
  const size = 170;
  const ax = 56;
  const ay = (RANK_HEIGHT - size) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(ax + size / 2, ay + size / 2, size / 2 + 6, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ax + size / 2, ay + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  const avatar = input.avatar && readImageInfo(input.avatar) ? await loadImage(Buffer.from(input.avatar)).catch(() => null) : null;
  if (avatar) ctx.drawImage(avatar, ax, ay, size, size);
  else {
    ctx.fillStyle = "#2b3138";
    ctx.fillRect(ax, ay, size, size);
    ctx.fillStyle = accent;
    ctx.font = `800 80px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText([...input.username][0]?.toUpperCase() ?? "?", ax + size / 2, ay + size / 2 + 5);
  }
  ctx.restore();

  const tx = ax + size + 48;
  const right = RANK_WIDTH - 50;
  ctx.textBaseline = "alphabetic";

  // Rank and level, top right
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `700 24px ${FONT}`;
  const levelText = String(input.level);
  const rankText = `#${input.rank}`;
  ctx.fillStyle = accent;
  ctx.font = `800 52px ${FONT}`;
  ctx.fillText(levelText, right, 82);
  const levelWidth = ctx.measureText(levelText).width;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("LEVEL", right - levelWidth - 10, 82);
  const labelWidth = ctx.measureText("LEVEL").width;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 52px ${FONT}`;
  const rankWidthLeft = right - levelWidth - 10 - labelWidth - 40;
  ctx.fillText(rankText, rankWidthLeft, 82);
  const rankWidth = ctx.measureText(rankText).width;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText("RANK", rankWidthLeft - rankWidth - 10, 82);

  // Name
  ctx.textAlign = "left";
  const name = fitText(ctx, input.username, right - tx - 20, 46, 26, 800);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${name.px}px ${FONT}`;
  ctx.fillText(name.text, tx, 150);

  // XP numbers
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `700 24px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(`${compact(input.into)} / ${compact(input.needed)} XP`, right, 196);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(`${compact(input.totalXp)} XP in total`, tx, 196);

  // Progress bar
  const by = 212;
  const bw = right - tx;
  ctx.fillStyle = "#2b3138";
  roundRect(ctx, tx, by, bw, 26, 13);
  ctx.fill();
  const filled = Math.max(26, Math.round((bw * Math.min(100, Math.max(0, input.percent))) / 100));
  if (input.percent > 0) {
    ctx.fillStyle = accent;
    roundRect(ctx, tx, by, filled, 26, 13);
    ctx.fill();
  }

  return canvas.toBuffer("image/png");
}
