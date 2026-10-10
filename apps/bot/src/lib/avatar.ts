import { readImageInfo } from "@aboutselphy/shared/image-info";
import { log } from "./log";

const AVATAR_HOSTS = new Set(["cdn.discordapp.com", "media.discordapp.net"]);
const MAX_AVATAR_BYTES = 1_000_000;

/** A member's avatar from Discord's CDN, or null (wrong host, too big, not a picture, slow). Never throws. */
export async function fetchAvatar(url: string): Promise<Uint8Array | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !AVATAR_HOSTS.has(parsed.hostname)) return null;
    const res = await fetch(parsed, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES || !readImageInfo(bytes)) return null;
    return bytes;
  } catch (err) {
    log.info({ err }, "welcome card: could not fetch the avatar, drawing the initial instead");
    return null;
  }
}
