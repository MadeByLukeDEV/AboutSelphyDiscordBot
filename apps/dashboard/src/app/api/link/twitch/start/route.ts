import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { allowAttempt, startVipLink, VIP_LINK_COOKIE, VIP_LINK_COOKIE_MAX_AGE, VIP_LINK_COOKIE_PATH } from "@/modules/twitchvip/link";

export const dynamic = "force-dynamic";

// "Link with Discord" (the button /vip link shows). Public on purpose: members aren't staff. Sets a state cookie and
// sends them to Discord's consent screen (scopes identify + connections).
export async function GET(request: NextRequest) {
  const back = (status: string) => NextResponse.redirect(`${siteUrl()}/vip-link?status=${status}`, 303);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allowAttempt(`start:${ip}`)) return back("tooMany");
  const start = startVipLink();
  if (!start) return back("notConfigured");

  const response = NextResponse.redirect(start.url, 303);
  response.cookies.set(VIP_LINK_COOKIE, start.state, { httpOnly: true, secure: siteUrl().startsWith("https://"), sameSite: "lax", path: VIP_LINK_COOKIE_PATH, maxAge: VIP_LINK_COOKIE_MAX_AGE });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
