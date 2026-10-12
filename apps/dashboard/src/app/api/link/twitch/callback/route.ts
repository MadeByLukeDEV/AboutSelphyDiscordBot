import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { allowAttempt, completeVipLink, VIP_LINK_COOKIE, VIP_LINK_COOKIE_PATH } from "@/modules/twitchvip/link";

export const dynamic = "force-dynamic";

// Discord's redirect after the consent screen (register <NEXT_PUBLIC_SITE_URL>/api/link/twitch/callback as a redirect
// for the Discord application). The state cookie from /start must match. The outcome goes back to /vip-link as a
// short code, never Discord's own text.
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const outcome = allowAttempt(`callback:${ip}`) ? await completeVipLink({ params: request.nextUrl.searchParams, cookie: request.cookies.get(VIP_LINK_COOKIE)?.value }) : "tooMany";
  console.info("[vip-link] callback:", outcome);

  const response = NextResponse.redirect(`${siteUrl()}/vip-link?status=${outcome}`, 303);
  // Single use: the state is spent either way.
  response.cookies.delete({ name: VIP_LINK_COOKIE, path: VIP_LINK_COOKIE_PATH });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
