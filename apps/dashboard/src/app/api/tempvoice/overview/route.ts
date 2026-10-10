import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { getTempVoiceOverview } from "@/modules/tempvoice";

export const dynamic = "force-dynamic";

// Admins only, like the page it feeds. The proxy skips /api, so this authorizes
// itself. The answer says "online: false" instead of failing when the bot is
// unreachable, so the page can show a calm message.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    throw error;
  }
  const overview = await getTempVoiceOverview();
  return Response.json(overview ? { online: true, overview } : { online: false }, { headers: { "cache-control": "no-store" } });
}
