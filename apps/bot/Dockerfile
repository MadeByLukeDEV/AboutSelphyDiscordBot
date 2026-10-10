# syntax=docker/dockerfile:1

# Build from the REPO ROOT so the workspace packages are available:
#   docker build -f apps/bot/Dockerfile -t aboutselphy-bot .
# Dokploy: build path "/", Dockerfile path "apps/bot/Dockerfile".
#
# Same three-stage layout as Main. The bot runs TypeScript directly through
# tsx (a runtime dependency, like in the other apps) and never runs migrations:
# the dashboard container owns them.

# ---- deps: all dependencies of the bot and the packages it uses ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
# Every workspace package.json, so the lockfile matches the workspace.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/bot/package.json apps/bot/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
# The pnpm store lives in a BuildKit cache mount: a failed or retried install
# resumes where it stopped instead of re-downloading everything, and the runner
# stage reuses what this stage fetched (sharing=locked serialises the two).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm install --frozen-lockfile --store-dir /pnpm-store --filter "@aboutselphy/bot..."

# ---- builder: Prisma client + typecheck (no runtime env here) ----
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/bot/node_modules ./apps/bot/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/bot apps/bot
COPY packages/db packages/db
COPY packages/shared packages/shared
RUN pnpm --filter @aboutselphy/db generate \
 && pnpm --filter @aboutselphy/bot typecheck

# ---- runner: production deps + sources, non-root ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production BOT_API_PORT=3100
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/bot/package.json apps/bot/
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
# In the same layer: delete pnpm's store and root's caches, then the package
# managers the base image ships (nothing runs as root at runtime; this removes
# npm's bundled CVEs). Same trick as Main.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store,sharing=locked \
    pnpm install --prod --frozen-lockfile --store-dir /pnpm-store --filter "@aboutselphy/bot..." \
 && rm -rf /root/.cache /root/.local/share/pnpm \
 && rm -rf /usr/local/lib/node_modules /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg \
      /usr/local/bin/pnpm /usr/local/bin/pnpx

# Every runtime directory needs its own COPY: a missing one fails silently.
COPY apps/bot/src apps/bot/src
COPY apps/bot/tsconfig.json apps/bot/
COPY tsconfig.base.json ./
COPY packages/shared/src packages/shared/src
COPY packages/db/src packages/db/src
# The generated Prisma client (gitignored, so it only exists in the builder).
COPY --from=builder /app/packages/db/src/generated packages/db/src/generated

USER node
WORKDIR /app/apps/bot
EXPOSE 3100

# /health is 503 until the gateway is ready and the DB answers.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3100/health || exit 1

CMD ["node", "--import", "tsx", "src/index.ts"]
