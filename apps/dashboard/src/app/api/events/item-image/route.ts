import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { getItemPictureFile } from "@/modules/eventcal";

export const dynamic = "force-dynamic";

// The picture an admin uploaded for an item, shown in the event settings. /api is outside the proxy, so this route checks the session itself.
// The type comes from the stored (verified) bytes and nosniff is set, so the browser never guesses a different one.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse(null, { status: 401 });
    throw error;
  }
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return new NextResponse(null, { status: 400 });
  const file = await getItemPictureFile(id);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), { headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
