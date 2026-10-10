import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";

// Builds every logo size from the one source picture (apps/dashboard/public/brand/logo-source.png):
// the dashboard's favicon and app icons, the logo shown in the sidebar, and the bot's Discord avatar.
// The source is small (128 px), so larger sizes are scaled up smoothly. Run it again after replacing
// the source: pnpm --filter @aboutselphy/bot brand
const root = resolve(import.meta.dirname, "../../dashboard");
const source = await loadImage(resolve(root, "public/brand/logo-source.png"));

function render(size: number): Buffer {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size, size);
  return canvas.toBuffer("image/png");
}

function save(rel: string, data: Buffer) {
  const path = resolve(root, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  console.log("wrote", rel, data.length, "bytes");
}

/** A .ico that holds one PNG image (supported by every current browser). */
function ico(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // one image
  header.writeUInt8(size, 6); // width
  header.writeUInt8(size, 7); // height
  header.writeUInt16LE(1, 12); // planes
  header.writeUInt16LE(32, 14); // bits per pixel
  header.writeUInt32LE(png.length, 14 + 4); // size of the image data
  header.writeUInt32LE(22, 18); // offset of the image data
  return Buffer.concat([header, png]);
}

save("src/app/icon.png", render(192));
save("src/app/apple-icon.png", render(180));
save("src/app/favicon.ico", ico(render(48), 48));
save("public/brand/logo.png", render(256));
save("public/brand/bot-avatar.png", render(512));
