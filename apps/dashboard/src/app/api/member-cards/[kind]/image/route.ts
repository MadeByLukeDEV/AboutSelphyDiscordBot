import { NextResponse } from "next/server";
import { isMemberCardKind } from "@aboutselphy/shared/member-card";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { getCardImageFile } from "@/modules/member-cards";

export const dynamic = "force-dynamic";

// The picture an admin uploaded for a birthday or reminder card, shown in the settings. /api is
// outside the proxy, so this route checks the session itself. The type comes from the stored
// (verified) bytes and nosniff is set, so the browser never guesses a different one.
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse(null, { status: 401 });
    throw error;
  }
  const { kind } = await params;
  if (!isMemberCardKind(kind)) return new NextResponse(null, { status: 404 });
  const file = await getCardImageFile(kind);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
