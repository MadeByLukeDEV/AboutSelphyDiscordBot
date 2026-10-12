import { NextResponse, type NextRequest } from "next/server";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import { caseQuerySchema, getCasesCsv } from "@/modules/moderation";

export const dynamic = "force-dynamic";

// The cases page's "Export CSV" link. /api is outside the proxy, so this route checks the session itself (any staff).
// It exports what the page is filtering (same query rules, invalid values fall back to "no filter"), at most 10 000 cases.
export async function GET(request: NextRequest) {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return new NextResponse("Forbidden", { status: 403 });
    throw error;
  }
  const params = request.nextUrl.searchParams;
  const query = caseQuerySchema.parse({ type: params.get("type") ?? undefined, q: params.get("q") ?? undefined, page: 1 });
  const csv = await getCasesCsv(query);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cases-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
