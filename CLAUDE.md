# AboutSelphy — Discord Bot + Dashboard

A **live Discord bot** (persistent gateway connection, slash commands) for the
AboutSelphy server, plus a **staff dashboard** to configure it. Sibling repos
(`../Auth`, `../Main`, `../SocialMedia Tree`, `../extension`): when unsure how
something is done, **look there first** and copy the pattern. Their CLAUDE.md
files hold hard-won lessons (CSP nonce, lazy clients, Prisma migrations on this
DB, Cloudflare vs webhooks, Dokploy Dockerfile). Don't re-learn them.

## Scope and priorities

Priority order (decided 2026-10-08; reorder only with the user). Each phase
ships its dashboard page with it.

| # | Phase | Why here |
| --- | --- | --- |
| 0 | **Foundation**: monorepo, env, DB schema `bot`, bot goes online with `/ping`, command framework, internal API, dashboard shell with central auth, Dockerfiles | Everything depends on it; proves "alive" |
| 1 | **Moderation + Logs**: `/warn /timeout /ban /kick /unban /purge /note /case /infractions`, case numbers, mod-log channel, audit-log capture of actions done in Discord's UI | Logs need the case system; every later feature reuses this engine |
| 2 | **Anti-bot / spam patterns** → delete message, 1-week timeout, case + log | Protective, tiny once phase 1 exists. **Blocked on the user's patterns**; build engine + dry-run mode first |
| 3 | **Went Live** (Twitch EventSub WebSocket) | Highest viewer value, isolated, Twitch app already exists |
| 4 | **Temporary voice channels** | Biggest interactive UI build; do it once infra is solid |
| 5 | **Announcements** (dashboard composer, embed preview, schedule, role ping) | Needs the dashboard editor patterns from 1–4 |
| 6 | **New video upload** (YouTube) | Small, polling-based |
| 7 | **Webhooks** | Lowest urgency; meaning still to confirm (see Open decisions) |

Out of scope until the user says so: leveling/XP, music, economy, ticket system,
AI moderation, multi-guild support.

## Tech stack (same as the other aboutselphy apps)

- **pnpm workspace monorepo**, TypeScript, Node 22 (alpine images). Deployed on
  **Dokploy** as **two apps** from one repo: `bot` and `dashboard`.
- `apps/dashboard`: **Next.js 16** (App Router, Turbopack, `src/proxy.ts`), React
  19, Tailwind v4, shadcn `base-nova` (Base UI, not Radix), `motion`, next-intl
  (de/en, **cookie-based, no URL prefix**, like Social's dashboard / Main's
  `/admin`), next-themes, react-hook-form + zod, sonner, lucide-react.
- `apps/bot`: **discord.js 14** (checked 2026-10-08: 14.27.0). Plain Node
  process, `node:http` or Fastify for the small internal API, `pino` logging.
- `packages/db`: **PostgreSQL + Prisma 7** (`@prisma/adapter-pg`), shared
  instance in the AboutSelphy Dokploy namespace, **own schema `bot`**, role
  `aboutselphy_bot`, no new database, no `CREATEDB`.
- Twitch: raw **EventSub WebSocket** (`ws`) + Helix; `@twurple/*` is allowed if it
  saves real code, decide at phase 3. YouTube: Data API v3 with the uploads
  playlist. Redis (shared, optional, **fail-soft**) only if needed.
- **Auth: `auth.aboutselphy.com`.** The dashboard has no auth instance of its
  own. Copy `../Auth/consumer/validate-session.ts` into
  `apps/dashboard/src/modules/auth/session.ts` and keep it in sync.

```
apps/
  bot/src/
    index.ts            # login, graceful shutdown
    client.ts           # intents, lazy singletons
    commands/           # one file per slash command, auto-registered
    events/             # one file per gateway event
    modules/<feature>/  # service.ts, repository.ts (private), schema.ts, commands.ts, events.ts
    internal-api/       # POST /internal/* for the dashboard, GET /health
    lib/                # env.ts (zod), log.ts, token-cipher.ts, platforms/{twitch,youtube}.ts
  dashboard/src/
    proxy.ts            # auth gate + CSP nonce
    app/                # thin routes
    modules/            # actions.ts, service.ts, repository.ts (private), schema.ts, components/
packages/db/            # prisma/schema.prisma, migrations, generated client
packages/shared/        # zod schemas and constants used by both apps
```

Modular-monolith rules from Social/Main apply in **both** apps: import only a
module's `actions.ts`/`service.ts`/`index.ts`, never another module's
`repository.ts`; routes stay thin.

## Do not use stale knowledge

- **Next 16**: `middleware.ts` → `src/proxy.ts`; `params`, `searchParams`,
  `cookies()`, `headers()` are Promises; `next lint` is gone. Read
  `node_modules/next/dist/docs/` if unsure.
- **Prisma 7**: pin `prisma` and `@prisma/client` to exactly **`7.10.0`**.
  Checked 2026-10-08: npm `latest` for `prisma` is `8.0.0-rc.21`. Always
  `pnpm exec prisma …`, never `pnpm dlx`. Config in `prisma7.config.ts`
  (loads `.env.local` then `.env`, appends `?schema=`), generator
  `prisma-client` → `src/generated/prisma` (gitignored). **No `migrate dev`**
  (no shadow DB): `migrate diff --from-schema <prev> --to-schema … --script`,
  review, **delete any `CREATE SCHEMA`**, `migrate deploy`, `generate`. Add
  CHECK constraints by hand. `dotenv` and `tsx` are runtime dependencies. Use
  the project skills in `.claude/skills/prisma-*`.
- **discord.js 14**: use `GatewayIntentBits`, `PermissionFlagsBits`,
  `MessageFlags`, interactions via `ChatInputCommandInteraction`; check
  https://discord.js.org docs before using any flag you are not sure exists
  (e.g. voice `Stream` = video/screen share, `UseSoundboard`,
  `UseExternalSounds`).
- **Twitch EventSub WebSocket** (checked 2026-10-08): `wss://eventsub.wss.twitch.tv/ws`;
  subscribe within **10 s** of `session_welcome` or it closes; no
  keepalive/notification within `keepalive_timeout_seconds` = dead, reconnect and
  resubscribe; on `session_reconnect` connect to the given URL, wait for its
  welcome, then close the old one (subscriptions carry over); needs a **user
  access token** (app tokens fail); max 3 connections, 300 subs/connection,
  `max_total_cost` 10. So the bot needs the broadcaster's (or a bot account's)
  user token, stored encrypted with refresh. Details to verify in the docs when
  building phase 3.

## Bot architecture rules

- **Alive means supervised**: gateway reconnects are handled by discord.js; add a
  `GET /health` (gateway ready, ping, DB `SELECT 1`) used as the Docker
  `HEALTHCHECK` and Dokploy restart policy. Graceful `SIGTERM`: stop timers,
  close the Twitch socket, `client.destroy()`, `prisma.$disconnect()`.
- **Single guild** (`DISCORD_GUILD_ID`). Ignore every other guild's events and
  leave unknown guilds. Slash commands are registered **per guild** on boot
  (instant), only when a hash of the command definitions changed.
- **Intents** (enable in the Developer Portal): `Guilds`, `GuildMembers`*,
  `GuildModeration`, `GuildMessages`, `MessageContent`* (anti-bot patterns),
  `GuildVoiceStates`. *privileged.
- **Lazy clients**: Prisma, pg, Redis, Discord client are built on first use
  (Proxy pattern from `../SocialMedia Tree/src/lib/prisma.ts`). `docker build`
  has no env.
- **Dashboard → bot**: the dashboard writes config to Postgres and calls the bot's
  **internal API** (`POST /internal/...`, `Authorization: Bearer BOT_API_SECRET`,
  constant-time compare, reachable only on the Dokploy internal network, never
  published). The bot is the **only** thing that talks to Discord for side
  effects (send/edit announcement, create channel, timeout). The bot caches
  config in memory; the dashboard triggers `POST /internal/reload/<module>`, and
  every cache also has a **TTL fallback (60 s)**, because invalidation only
  reaches the process that was called (the `revalidateTag` lesson from Main).
- **Fail loud, log every branch**: each event handler, poller and webhook logs
  what it did and why it skipped (the silent-success Twitch webhook was
  undebuggable). Error messages shown to users are generic; no tokens, SQL or
  stack traces in Discord or the dashboard.
- **Idempotent and restart-safe**: anything that can be missed while the bot is
  down (live status, new uploads, temp VCs, timed-out users) is **reconciled on
  startup** from the DB and the platform APIs.
- **Never announce on first run**: a fresh poller seeds its baseline silently
  (Main posted a real Discord message from an unconfigured automatic run).
- **Dev and prod share the DB today → they must not share a bot.** Use a
  separate dev application/token and a test guild, and `DATABASE_SCHEMA=bot_dev`
  locally. Side-effecting jobs (Twitch, YouTube, scheduled announcements) only
  run when `BOT_ENV=production` or `BOT_INTEGRATIONS_IN_DEV=true`. Delete test
  data you create.
- **Permissions**: moderation commands also check the invoker's Discord role
  hierarchy (can't act on someone with an equal/higher role, the owner, or the
  bot) and the bot's own permissions; set `setDefaultMemberPermissions` but
  never rely on it alone. Mentions: always pass `allowedMentions` explicitly
  (`parse: []` plus the one role being pinged).
- Timeouts: Discord's max is **28 days**; anti-bot uses 7 days.

## Feature design notes

### Moderation + logs
- Tables: `ModCase` (guild-scoped sequential `caseNumber`, type
  warn/timeout/untimeout/kick/ban/unban/note/antibot, target id, moderator id or
  `system`, reason, expiresAt, evidence/message snapshot, `source`
  command|dashboard|audit-log|automod), `LogChannelConfig`.
- Actions done **inside Discord's UI** are captured through
  `guildAuditLogEntryCreate` and become cases too, deduped against cases the bot
  just created. Needs `View Audit Log`.
- Logs: mod actions (bans, timeouts, warnings) first; message edit/delete,
  joins/leaves, voice later, each routable to its own channel, all togglable.
  Embeds show the user as `<@id>` plus the raw id; escape user text.
- Optional escalation (N warnings → timeout) is a config, off by default.

### Anti-bot / pattern rules
- User supplies the patterns later. Build the engine now with a **dry-run
  mode** (log "would have acted" only) and a global kill switch.
- Normalise text before matching (NFKC, strip zero-width/RTL characters,
  lowercase). Pattern kinds: literal/contains, glob, and regex. **Regex runs
  through `re2`** (no catastrophic backtracking) with a length cap; never raw
  `RegExp` on user-edited patterns.
- Action: delete the message, time out **7 days**, DM best-effort, `antibot`
  case, log. Exempt: moderators/admins (by Discord role), bots, an allowlist of
  roles/channels, members older than a configurable age (optional).
- Every rule has an id, enabled flag, hit counter and last hit, so false
  positives can be traced and tuned in the dashboard.

### Went Live (Twitch)
- EventSub WebSocket as above, subscribe `stream.online` / `stream.offline` for
  the configured broadcaster(s). Notification: embed with title, game, preview
  thumbnail (cache-busted), optional role ping, **edit the message on update,
  mark ended on offline** (configurable). Dedupe by Twitch stream id (reconnects
  and restarts replay). On startup reconcile with Helix `streams`.
- Token: user token + refresh token **encrypted** with `token-cipher`
  (`../Main/src/lib/security/token-cipher.ts`, purpose `twitch-bot-refresh-token`,
  `TOKEN_ENCRYPTION_KEY`), rotated refresh tokens always stored. Connected once
  from the dashboard (copy Main's `/api/twitch/connect|callback` flow incl.
  state cookie and "wrong account" check).
- Twitch redirect URLs must be registered in the console for the used Client ID.

### Temporary voice channels
- A "join to create" lobby channel per config. On join the bot creates a voice
  channel in the configured category, moves the member, grants them owner
  overwrites. Deleted when empty. Persisted in `TempVoiceChannel`; orphans are
  cleaned and re-adopted on startup.
- Owner controls through `/voice …` and a control panel message with
  buttons/select menus: name, **user limit**, lock/unlock, **allow-list of who
  may join** (Connect overwrites), **allow video** (Stream), **allow soundboard**
  (UseSoundboard / UseExternalSounds), bitrate, kick, ban from channel, transfer
  ownership, claim if owner left. Rate-limit channel renames (Discord: 2 per 10 min).
- Dashboard: lobby/category setup, default limit/name template, banned names,
  per-role max channels.

### Announcements
- Composer in the dashboard (content, embed fields, image, colour, channel,
  optional role ping, send now / schedule), live preview, stored history,
  edit/delete of sent messages. Sent by the bot through the internal API.
  Escape or allow-list markup; never let staff text create unintended pings.
  Scheduled sends are picked up by a bot timer and survive restarts.

### New video upload (YouTube)
- Poll the **uploads playlist** (`UU` + channel id minus `UC`, `playlistItems.list`
  costs 1 quota unit; never `search.list`, 100 units) every ~5 min, dedupe by
  video id in the DB, Short = duration ≤ 180 s (same rule as Main). Public and
  embeddable only. Silent baseline on first run. No public callback needed
  (no WebSub, no Cloudflare rule).

### Webhooks
- To confirm with the user (see Open decisions): outgoing Discord webhooks managed
  from the dashboard (URL stored **encrypted**, only `discord(app).com` URLs, as
  in `../Main/src/lib/platforms/discord.ts`) and/or an inbound endpoint where
  external services POST and the bot relays. Inbound endpoints must verify an
  HMAC over the raw `request.text()` with `timingSafeEqual`, reject stale
  timestamps/replays, and need a path-scoped Cloudflare WAF rule skipping Bot
  Fight Mode **up front**.

## Dashboard

- **Auth**: staff only. Redirect to
  `${AUTH_URL}/login?redirect=<url built from NEXT_PUBLIC_SITE_URL>`; sign-out is
  a form POST to `${AUTH_URL}/api/sign-out`; add this app's origins (prod and
  `http://localhost:3004`) to the auth service's `TRUSTED_ORIGINS`. Check
  `coalesce(s.role, u.role)` via the copied validator; it fails closed. Roles via
  `roles.ts` helpers (`isAdmin`, `canAccessDashboard`), never inline strings.
  Enforce in `proxy.ts` **and** in every Server Action (`requireAdmin()` /
  `requireStaff()`). Show `session.user.name` in the header.
- **Role split (proposal)**: moderators: logs, cases, warnings, announcements.
  Admins: everything else (anti-bot rules, temp-voice, Twitch/YouTube connections,
  webhooks, bot config).
- **Frontend conventions** (same as Main/Social): brand `#00FFA8`, Plus Jakarta
  Sans, **rem only (never px, also inside `clamp()`)**, mobile-first, skeletons
  for everything async, `Field`/`FieldGroup` forms (no `Form`), `FormSelect` not
  native `<select>`, Base UI `render` prop not `asChild`, `useSyncExternalStore`
  for mounted checks, client state seeded from props updated via action return
  values (not `revalidatePath`), `id={useId()}` on every dnd-kit `DndContext`,
  next-themes script type fix, reduced-motion respected. After `shadcn add`,
  fix `import { cn } from "cn"` → `@/lib/utils` and px sizes.
- **Security headers + nonce CSP** exactly as in `../Main` (`proxy.ts`, `csp.ts`,
  matcher without backslashes, verify on a production build).
- Env vars read through a lazy zod-validated `env()`; secrets never in
  `NEXT_PUBLIC_*`; `import "server-only"`.
- Dashboard shows bot status (gateway ping, uptime, last event per module) from
  the bot's `/health`, fetched client-side so a down bot can't slow the page.

## Security (high priority)

Run `security-review` before merging anything touching auth, the internal API,
tokens, webhooks, pattern matching, or message output.

- Bot token, Twitch/Google secrets: env only, never logged, never in the DB in
  plain text. Stored user/streamer tokens use AES-256-GCM `token-cipher`.
- Validate every input with zod (action args, internal API bodies, platform
  payloads). Server Actions are public POST endpoints.
- Least-privilege DB roles like Main (`aboutselphy_bot` owns schema `bot` only;
  the dashboard reads auth with `aboutselphy_auth_reader`).
- Pin exact versions for discord.js, Next, Prisma, auth packages; add no package
  without a reason; `pnpm audit --prod` before release.
- Never trust Discord-supplied text in embeds/logs: escape markdown, mentions
  and links where the content is user-controlled.
- GDPR: moderation cases hold personal data; define retention (e.g. notes and
  expired cases pruned after a fixed period) before going live.

## Deployment (Dokploy)

- Two Dockerfiles (`apps/bot/Dockerfile`, `apps/dashboard/Dockerfile`), same
  three-stage layout as Main (`deps` → `builder` → `runner`, `node:22-alpine`,
  unprivileged `node` user, explicit `COPY` for every runtime dir, package
  managers deleted from the runner). Build from the **repo root** so workspace
  packages are available. Test the image from a **fresh clone** with no env.
- Migrations: the dashboard container runs `prisma migrate deploy` on start (one
  owner for migrations); the bot waits for the DB and never migrates.
- Bot container: restart `always`, `HEALTHCHECK` on `/health`, no public domain.
  Dashboard: own subdomain, health path `/api/health`.
- Cron-like work lives **inside the bot** (timers), not Dokploy schedules.

## Git and GitHub (same pattern as Main/Social)

- Commit author `madebyluke <aboutselphy@gmail.com>`. Linear history: push the
  branch, `git merge --ff-only` into `main`. **No remote, push or PR without
  asking. Ask before `git init`.**
- Branches: `feature_<name>`, `fix_<name>`, `chore_<name>`, `docs_<name>`.
  Conventional Commits with module scope (`feat(moderation): …`), small commits,
  detailed bodies. Update this CLAUDE.md in the same branch as the feature.

## Claude skills and plugins to use

| When | Skill / plugin |
| --- | --- |
| Starting each phase | `claude-mem:make-plan` → `claude-mem:do` |
| Past decisions from Auth / Main / Social | `claude-mem:mem-search` |
| Unfamiliar code in sibling repos | `claude-mem:smart-explore` |
| Prisma schema, client, migrations, adapter | `.claude/skills/prisma-cli`, `prisma-client-api`, `prisma-database-setup`, `prisma-driver-adapter-implementation`, `prisma-upgrade-v7` |
| Any new dashboard page or visual direction | `frontend-design:frontend-design` |
| Layout, UX, palette, component review | `ui-ux-pro-max:ui-ux-pro-max` |
| shadcn / Tailwind components, dark mode | `ui-ux-pro-max:ui-styling` |
| Tokens, fluid scale in `globals.css` | `ui-ux-pro-max:design-system` |
| Bot avatar, banner, embed art | `ui-ux-pro-max:banner-design`, `ui-ux-pro-max:design` |
| Mod stats, case charts, stat tiles | `dataviz` |
| Design critique before shipping a page | `claude-mem:design-is` |
| Driving the dashboard, screenshots, console/network checks | `run`, `anthropic-skills:built-in-browser` |
| Before every merge | `code-review`, `security-review`, `simplify` |
| Permission prompts getting noisy | `fewer-permission-prompts` |
| Figma designs, if any | Figma MCP (`/figma-use` first) |

No Discord/Twitch skill exists in the catalog (searched 2026-10-08): check the
official docs (discord.js.org, discord.com/developers/docs,
dev.twitch.tv/docs/eventsub) before writing platform code.

## Commands (once scaffolded)

```
pnpm install
pnpm dev:bot                       # tsx watch apps/bot (dev bot token + test guild!)
pnpm dev:dashboard                 # next dev -p 3004
pnpm build / pnpm lint / pnpm typecheck / pnpm test
pnpm --filter @aboutselphy/db exec prisma migrate deploy
pnpm --filter @aboutselphy/db exec prisma generate
pnpm commands:register             # force re-register slash commands
```

## Environment variables

Keep `.env.example` complete and commented; defaults are production values where
safe. Bot: `DISCORD_BOT_TOKEN`, `DISCORD_APP_ID`, `DISCORD_GUILD_ID`,
`DISCORD_ADMIN_ROLE_IDS`, `DISCORD_MODERATOR_ROLE_IDS`, `DATABASE_URL`,
`DATABASE_SCHEMA`, `BOT_API_SECRET`, `BOT_API_PORT`, `TOKEN_ENCRYPTION_KEY`,
`BOT_ENV`, `BOT_INTEGRATIONS_IN_DEV`, `TWITCH_CLIENT_ID/_SECRET`,
`TWITCH_BROADCASTER_LOGIN`, `YOUTUBE_API_KEY`, `YOUTUBE_CHANNEL_ID`.
Dashboard: `DATABASE_URL`, `AUTH_URL`, `AUTH_DATABASE_URL`,
`AUTH_DATABASE_SCHEMA`, `BETTER_AUTH_SECRET`, `AUTH_COOKIE_PREFIX`,
`BOT_API_URL`, `BOT_API_SECRET`, `NEXT_PUBLIC_SITE_URL`, `TOKEN_ENCRYPTION_KEY`.
Use plain-hex secrets (`crypto.randomBytes(32).toString("hex")`).

## Open decisions

- Dashboard domain (proposal: `bot.aboutselphy.com`, not yet confirmed).
- Which Discord server and which roles are staff (reuse the Auth env values).
- Anti-bot patterns and exemptions (user provides).

Decided 2026-10-08:
- **No old dashboard exists.** This is a fresh build; all authentication goes
  through `auth.aboutselphy.com` (no session migration needed).
- **Webhooks: both directions** (outgoing managed webhooks + inbound relay
  endpoint). Later ideas: provider presets (GitHub, Ko-fi, Stripe-style) and
  outbound "bot event" webhooks (ban, went live) for other tools.
- **Dev isolation: yes.** Separate dev Discord application + test guild and
  `DATABASE_SCHEMA=bot_dev` locally.
- **Role split confirmed**: moderators = logs, cases, warnings, announcements;
  admins = everything else.
- **Git: same workflow as Main/Social.** One branch per piece of work
  (`feature_`, `fix_`, `chore_`, `docs_`), conventional commits, ff-only merge
  into `main`, local only until the user says to add a remote.

## Lessons so far

- **`@swc/core` is pinned to 1.16.2** (`pnpm-workspace.yaml` overrides). Newer
  versions refuse to load their native addon when the cache dir or an ancestor
  is writable by groups like Authenticated Users (`ERR_SWC_NATIVE_CACHE`),
  which is true for `D:\Work` here. next-intl pulls it in, so `next build` /
  `next typegen` crash without the pin. Main/Social are on 1.16.2.
- pnpm adds a `'pkg': set this to true or false` placeholder to `allowBuilds`
  for ignored build scripts. If the key already exists the file no longer
  parses (duplicate key) and pnpm **and** the Prisma CLI both fail. Edit the
  existing entry instead.
- Prisma's `migrate diff --from-empty` emits `CREATE SCHEMA IF NOT EXISTS
  "public"`: delete it by hand (see the Prisma note above).
- Long heredocs in the Bash tool can fail to parse; write files with the Write
  tool. Never run `git` commands against a sibling repo (`../Main`) by
  accident: use absolute paths and check `git branch --show-current` first.
- Dev environment: local Node is v26 (Prisma only warns), images use Node 22.

## Verified so far (2026-10-08, no live Discord/DB/auth available)

- `pnpm typecheck` passes in all four packages; the dashboard builds with no
  env (lazy clients) and `pnpm lint` is clean.
- Dashboard on a **production build**: signed-out `/` redirects to the auth
  login with the right return URL, CSP + nonce and all static headers are on the
  response, `/api/bot/status` returns 401 without a session, `/api/health` 200.
- Bot: env validation names missing variables, the token never appears in logs.
- **Not verified yet**: a real login against Discord (needs the dev bot token
  and test guild), a real session lookup (needs the auth DB), the migration
  against the real DB, and **both Dockerfiles** (`chore_dockerfiles`, kept off
  `main` until a fresh-clone build and run succeeds; Docker is off for now).

## Feature status

- [~] Phase 0 — foundation: code done and merged (monorepo, db package +
      migration + role script, bot core with `/ping` + health + internal API,
      dashboard shell with central auth). Open: Dockerfiles (unverified, branch
      `chore_dockerfiles`), first live run with the dev bot.
- [~] Phase 1 — moderation + logs
  - [x] Core (2026-10-09, branch `feature_moderation-core`): `ModCase` /
        `ModConfig` tables (atomic case counter on the singleton row, hand-written
        CHECKs), `/warn /timeout /untimeout /kick /ban /unban /note /case
        /infractions` and admin `/modlog channel|off|dm|status`. Flow in
        `modules/moderation/service.ts`: bot permission → hierarchy
        (`hierarchy.ts`, pure, tested) → Discord action → **case only after
        Discord accepted it** → embed in the log channel. DM to the member
        before kick/ban, after warn/timeout (config `dmOnAction`). All user text
        is escaped (`lib/escape.ts`, same rules as Main). Pure parts and the
        command definitions are unit-tested (21 tests); **the DB and Discord
        paths are not tested yet** (no dev bot/DB access in the build session).
        Slash commands are only visible to staff by code check
        (`requires`), Discord's default permissions are just a UI hint.
  - [ ] Audit-log capture (`guildAuditLogEntryCreate`, needs the
        `GuildModeration` intent) so bans/timeouts done in Discord's UI become
        cases too, deduped against bot-made ones
  - [ ] `/purge`, warning pardon, escalation config, temp bans (needs a scheduler)
  - [ ] More log types (message edit/delete, joins/leaves, voice)
  - [ ] Dashboard: cases list/detail, user history, log settings
- [ ] Phase 2 — anti-bot
- [ ] Phase 3 — went live
- [ ] Phase 4 — temporary voice channels
- [ ] Phase 5 — announcements
- [ ] Phase 6 — new video upload
- [ ] Phase 7 — webhooks
