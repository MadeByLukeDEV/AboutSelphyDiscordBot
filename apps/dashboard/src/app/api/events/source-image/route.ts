import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { getBackgroundFile } from "@/modules/eventcal";

export const dynamic = "force-dynamic";

// The background picture of a game's drawn cards. Admin only; same rules as the item pictures.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse(null, { status: 401 });
    throw error;
  }
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return new NextResponse(null, { status: 400 });
  const file = await getBackgroundFile(id);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), { headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
