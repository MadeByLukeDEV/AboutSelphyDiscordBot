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
    ].join(", "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The welcome card picture (up to 3 MB) is uploaded through a Server Action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // The workspace packages export TypeScript sources.
  transpilePackages: ["@aboutselphy/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
