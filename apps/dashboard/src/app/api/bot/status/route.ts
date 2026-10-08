import { getBotStatus } from "@/modules/bot-status";
import { AuthorizationError, requireStaff } from "@/modules/auth";

export const dynamic = "force-dynamic";

// Staff only: the status carries the guild id and uptime. The proxy skips
// /api, so this authorizes itself.
export async function GET() {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    throw error;
  }
  return Response.json(await getBotStatus(), { headers: { "cache-control": "no-store" } });
}
