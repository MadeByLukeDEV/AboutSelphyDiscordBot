/** 24-bit colour number to "#rrggbb". */
export function colorToHexString(color: number): string {
  return `#${Math.min(0xffffff, Math.max(0, Math.trunc(color))).toString(16).padStart(6, "0")}`;
}

/** "#rrggbb" to a number, or undefined. */
export function hexStringToColor(hex: string): number | undefined {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  return match ? Number.parseInt(match[1]!, 16) : undefined;
}

/** A Date as the value of a datetime-local input, in the browser's own time zone. */
export function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
