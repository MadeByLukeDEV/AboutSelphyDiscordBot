import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { previewPicture } from "@/modules/eventcal";

export const dynamic = "force-dynamic";

const query = z.object({ source: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), event: z.string().regex(/^[A-Za-z0-9_-]{0,64}$/).default(""), month: z.enum(["none", "current", "next"]).default("none") });

// A sample picture drawn by the bot from the saved settings: an event's card, or a month's overview picture. Admin only.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse(null, { status: 401 });
    throw error;
  }
  const params = query.safeParse({ source: request.nextUrl.searchParams.get("source") ?? "", event: request.nextUrl.searchParams.get("event") ?? "", month: request.nextUrl.searchParams.get("month") ?? "none" });
  if (!params.success) return new NextResponse(null, { status: 400 });
  const png = await previewPicture(params.data.source, params.data.event, params.data.month);
  if (!png) return new NextResponse(null, { status: 503 });
  return new NextResponse(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
