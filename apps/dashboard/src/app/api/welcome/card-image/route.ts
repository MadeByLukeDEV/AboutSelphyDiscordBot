import { NextResponse } from "next/server";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { getCardImageFile } from "@/modules/welcome";

export const dynamic = "force-dynamic";

// The picture the admin uploaded for the welcome card, shown in the settings. /api is outside the
// proxy, so this route checks the session itself. The type comes from the stored (verified) bytes
// and nosniff is set, so the browser never guesses a different one.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse(null, { status: 401 });
    throw error;
  }
  const file = await getCardImageFile();
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
