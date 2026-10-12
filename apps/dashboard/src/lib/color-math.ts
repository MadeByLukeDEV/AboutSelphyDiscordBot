// Colour maths for the colour picker. Pure. Hex is always "#rrggbb"; hue is 0-360, saturation and value 0-1.

export type Hsv = { h: number; s: number; v: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** "#rrggbb" (or "rrggbb", any case) to a normalised "#RRGGBB", or null if it isn't a colour. */
export function normalizeHex(input: string): string | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(input.trim());
  return match ? `#${match[1]!.toUpperCase()}` : null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt((normalizeHex(hex) ?? "#000000").slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function hexToHsv(hex: string): Hsv {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255] as const;
  const max = Math.max(rn, gn, bn);
  const d = max - Math.min(rn, gn, bn);
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const val = clamp(v, 0, 1);
  const c = val * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = val - c;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
