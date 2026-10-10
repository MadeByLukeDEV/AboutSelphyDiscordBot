import { NextResponse } from "next/server";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { getWelcomePreviewCard } from "@/modules/bot-api";

export const dynamic = "force-dynamic";

// A sample welcome card drawn by the bot from the saved settings. Admin only.
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse(null, { status: 401 });
    throw error;
  }
  const png = await getWelcomePreviewCard();
  if (!png) return new NextResponse(null, { status: 503 });
  return new NextResponse(Buffer.from(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
