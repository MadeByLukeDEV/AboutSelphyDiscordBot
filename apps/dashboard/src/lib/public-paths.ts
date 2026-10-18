// Pages anyone may read without signing in. Everything else is staff-only (src/proxy.ts).
// Keep this list short and exact: a path is public only if it is listed here.
const PUBLIC_PATHS = new Set(["/terms", "/privacy", "/vip-link", "/leaderboard", "/features"]);

// Public address families: "/widget/<id>" (a game's event widget; the page itself returns 404 unless an admin switched it on).
const PUBLIC_PREFIXES = ["/widget/"];

export function isPublicPath(pathname: string): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PATHS.has(clean) || PUBLIC_PREFIXES.some((p) => clean.startsWith(p) && clean.length > p.length && !clean.slice(p.length).includes("/"));
}
