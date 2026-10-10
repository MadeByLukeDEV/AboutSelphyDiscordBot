# syntax=docker/dockerfile:1

# Build from the REPO ROOT so the workspace packages are available:
#   docker build -f apps/dashboard/Dockerfile -t aboutselphy-bot-dashboard .
# Dokploy: build path "/", Dockerfile path "apps/dashboard/Dockerfile".
#
# Same layout as Main (not `output: "standalone"`: the runner needs the prisma
# CLI for `migrate deploy`). This container is the ONLY one that migrates.

# ---- deps: all dependencies of the dashboard and the packages it uses ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/bot/package.json apps/bot/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
# The pnpm store lives in a BuildKit cache mount: a failed or retried install
# resumes where it stopped instead of re-downloading everything, and the runner
# stage reuses what this stage fetched (sharing=locked serialises the two).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --filter "@aboutselphy/dashboard..."

# ---- builder: Prisma client + Next.js build (no runtime env here) ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/dashboard apps/dashboard
COPY packages/db packages/db
COPY packages/shared packages/shared
ENV NEXT_TELEMETRY_DISABLED=1
# The only build input. Baked into client JS at build time; the runner reuses
# the same value so server code agrees with it. Override only for another domain
# (Dokploy: Build-time Arguments). The build needs no secrets and no database.
ARG NEXT_PUBLIC_SITE_URL=https://bot.aboutselphy.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN pnpm --filter @aboutselphy/db generate \
 && pnpm --filter @aboutselphy/dashboard build

# ---- runner: production deps + build output, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=https://bot.aboutselphy.com
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/bot/package.json apps/bot/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
# Prisma's schema engine (needed by `migrate deploy`) is downloaded by
# @prisma/engines' postinstall, which does NOT fail the install when the
# download fails. `prisma version` (still root here) fetches a missing engine
# and the `ls` fails the build if it's still not there, instead of crashing on
# start as the unprivileged user. Then, in the same layer: delete pnpm's store
# and root's caches and the package managers the base image ships.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm install --prod --frozen-lockfile --store-dir /pnpm-store --filter "@aboutselphy/dashboard..." \
 && (cd packages/db && node_modules/.bin/prisma version >/dev/null) \
 && ls node_modules/.pnpm/@prisma+engines@*/node_modules/@prisma/engines/schema-engine-* \
 && rm -rf /root/.cache /root/.local/share/pnpm \
 && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg \
      /usr/local/bin/pnpm /usr/local/bin/pnpx

# Every runtime directory needs its own COPY: a missing one fails silently.
# Only .next is owned by `node` (Next writes its cache there); COPY --chown,
# never a later `RUN chown -R`, which stores the files twice.
COPY --from=builder --chown=node:node /app/apps/dashboard/.next apps/dashboard/.next
COPY apps/dashboard/next.config.ts apps/dashboard/
# The logo, favicon sources and other static files Next serves from /public.
COPY apps/dashboard/public apps/dashboard/public
COPY packages/shared/src packages/shared/src
COPY packages/db/src packages/db/src
COPY --from=builder /app/packages/db/src/generated packages/db/src/generated
COPY packages/db/prisma packages/db/prisma
COPY packages/db/prisma7.config.ts packages/db/

USER node
WORKDIR /app/apps/dashboard
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

# Applies pending migrations (idempotent), then starts the server. DATABASE_URL
# is the aboutselphy_bot role; DATABASE_SCHEMA defaults to "bot". Binaries are
# called directly, not through pnpm (deleted from the runner).
CMD ["sh", "-c", "(cd /app/packages/db && node_modules/.bin/prisma migrate deploy) && exec node_modules/.bin/next start"]
