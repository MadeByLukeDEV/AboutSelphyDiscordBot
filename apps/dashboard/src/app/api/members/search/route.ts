import { AuthorizationError, requireStaff } from "@/modules/auth";
import { searchMembers } from "@/modules/moderation";

export const dynamic = "force-dynamic";

// Staff only. The proxy skips /api, so this authorizes itself. Names only; the ID leads to the member page.
export async function GET(request: Request) {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return Response.json({ error: "unauthorized" }, { status: 401 });
    throw error;
  }
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(await searchMembers(q), { headers: { "cache-control": "no-store" } });
}
