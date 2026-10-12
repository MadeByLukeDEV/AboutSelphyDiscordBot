import { AuthorizationError, requireStaff } from "@/modules/auth";
import { listEmojis } from "@/modules/bot-api";

export const dynamic = "force-dynamic";

// The server's custom emotes for the emote picker (loaded the first time someone opens it). Staff only; the proxy skips
// /api, so this authorizes itself.
export async function GET() {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    throw error;
  }
  const emojis = await listEmojis();
  if (emojis === null) return Response.json({ error: "bot unavailable" }, { status: 503, headers: { "cache-control": "no-store" } });
  return Response.json({ emojis }, { headers: { "cache-control": "private, max-age=60" } });
}
