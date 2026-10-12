// Pages anyone may read without signing in. Everything else is staff-only (src/proxy.ts).
// Keep this list short and exact: a path is public only if it is listed here.
const PUBLIC_PATHS = new Set(["/terms", "/privacy", "/vip-link", "/leaderboard"]);

export function isPublicPath(pathname: string): boolean {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_PATHS.has(clean);
}
