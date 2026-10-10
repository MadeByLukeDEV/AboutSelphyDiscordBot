import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import {
  completeTwitchConnect,
  TWITCH_OAUTH_COOKIE,
  TWITCH_OAUTH_COOKIE_PATH,
  type ConnectOutcome,
} from "@/modules/twitch";

export const dynamic = "force-dynamic";

// Twitch's redirect after the consent screen (registered redirect URL:
// <NEXT_PUBLIC_SITE_URL>/api/twitch/callback). Admin only; the state cookie from
// /api/twitch/connect must match. The outcome goes back to /twitch as a code,
// never Twitch's own text.
export async function GET(request: NextRequest) {
  const cookie = request.cookies.get(TWITCH_OAUTH_COOKIE)?.value;
  let outcome: ConnectOutcome;
  try {
    const session = await requireAdmin();
    outcome = await completeTwitchConnect({ params: request.nextUrl.searchParams, cookie, connectedBy: session.user.name });
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    outcome = "forbidden";
  }
  console.info("[twitch] callback:", outcome);

  const response = NextResponse.redirect(`${siteUrl()}/twitch?connect=${outcome}`, 303);
  // Single use: the state is spent either way.
  response.cookies.delete({ name: TWITCH_OAUTH_COOKIE, path: TWITCH_OAUTH_COOKIE_PATH });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
