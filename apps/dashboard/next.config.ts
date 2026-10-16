import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// One env file for the whole repo: the bot and the Prisma CLI read the root
// .env.local, but Next only looks inside apps/dashboard. Already-set variables
// win (Dokploy's real env, or a dashboard-local .env.local), so this changes
// nothing in production, where no such files exist.
loadEnv({
  path: [path.resolve(process.cwd(), "../../.env.local"), path.resolve(process.cwd(), "../../.env")],
  quiet: true,
});

const withNextIntl = createNextIntlPlugin("./src/modules/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

// Static security headers for every response (same set as Main/Social/Auth).
// The per-request CSP with a nonce is set in src/proxy.ts.
const securityHeaders = [
  // Production only: HSTS on localhost would pin http://localhost too.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Legacy twin of CSP frame-ancestors 'none'.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Nobody else may embed or read our responses (pages, the logo, the API).
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // Staff-only: on EVERY response (pages, errors, /api, static files) tell search engines, archives
  // and AI crawlers to keep out. robots.txt (src/app/robots.ts) and the <meta> tag say the same.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex, noai, noimageai" },
  {
    key: "Permissions-Policy",
    value: [
      "camera=()",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "serial=()",
      "bluetooth=()",
      "browsing-topics=()",
      "interest-cohort=()",
      "accelerometer=()",
      "gyroscope=()",
      "magnetometer=()",
      "midi=()",
      "display-capture=()",
      "hid=()",
      "xr-spatial-tracking=()",
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The welcome card picture (up to 3 MB) is uploaded through a Server Action; the default limit is 1 MB.
  // Server Actions are public POST endpoints: besides Next's own same-origin check, only our own site
  // may call them (the host of NEXT_PUBLIC_SITE_URL, which is also what Traefik forwards).
  experimental: { serverActions: { bodySizeLimit: "4mb", allowedOrigins: [new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://bot.aboutselphy.com").host] } },
  // The workspace packages export TypeScript sources.
  transpilePackages: ["@aboutselphy/shared", "@aboutselphy/db"],
  async headers() {
    // The event widget (/widget/<id>) may be framed by other sites and OBS; everything else keeps DENY.
    // The CSP frame-ancestors for it is set in src/proxy.ts.
    return [
      { source: "/:path((?!widget/|api/events/public/).*)", headers: securityHeaders },
      // The public JSON may be read by other sites.
      { source: "/api/events/public/:path*", headers: securityHeaders.filter((h) => h.key !== "Cross-Origin-Resource-Policy") },
      { source: "/widget/:path*", headers: securityHeaders.filter((h) => h.key !== "X-Frame-Options" && h.key !== "Cross-Origin-Resource-Policy") },
    ];
  },
};

export default withNextIntl(nextConfig);
