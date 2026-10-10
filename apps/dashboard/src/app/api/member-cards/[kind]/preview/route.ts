import { NextResponse } from "next/server";
import { isMemberCardKind } from "@aboutselphy/shared/member-card";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { getMemberCardPreview } from "@/modules/bot-api";

export const dynamic = "force-dynamic";

// A sample card drawn by the bot from the saved settings. Admin only.
export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse(null, { status: 401 });
    throw error;
  }
  const { kind } = await params;
  if (!isMemberCardKind(kind)) return new NextResponse(null, { status: 404 });
  const png = await getMemberCardPreview(kind);
  if (!png) return new NextResponse(null, { status: 503 });
  return new NextResponse(Buffer.from(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
