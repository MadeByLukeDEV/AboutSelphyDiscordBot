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

**Order update (2026-10-10, the user):** moderation dashboard first (done), then
**Phase 4 (temporary voice channels)**, then **Phase 3 (Went Live)**. **Phase 2
(anti-bot) is skipped completely for now**: don't build its engine either until
the user brings it back.

Out of scope until the user says so: music (bots that stream YouTube/Spotify audio
break those services' terms and keep getting shut down), economy, AI moderation, multi-guild
support. Leveling/XP and tickets moved **into** scope on 2026-10-10 (see below).

### Replacement roadmap (added 2026-10-10)

Goal (the user): this bot **replaces** Streamcord, Dyno, Carl-bot, MEE6,
Voicetemp and VoiceMaster, so one config, one dashboard, one data store. The
anti-bot/pattern feature stays skipped. Everything below is a **proposal to
reorder with the user**; each item ships with its dashboard page, a `Modules`
on/off switch and the same rules as above (single guild, escaped output,
reconcile on startup, explicit `allowedMentions`).

Tier A, finish what the replaced bots are used for daily:
- **Moderation rest** (Dyno): `/purge` (by count, user, bots, links), `/slowmode`,
  `/lock` and `/unlock` channels, temp ban/timeout/mute via a scheduler that
  survives restarts, warning escalation (N warnings → action), role
  persistence (re-apply roles when a member rejoins), case notes editing, a
  per-member history page, warn/timeout/ban **from the dashboard**, case
  export, mod stats (cases per moderator).
- **More logs** (Dyno/Carl): message edit and delete (with attachments listed),
  bulk delete, joins/leaves with account age, nickname/role changes, channel
  and role changes, invite used (who invited whom), voice join/leave/move,
  each routable to its own channel and togglable, with a retention period.
- **Went Live** (Streamcord, phase 3): several streamers, a "Live" role while
  someone streams, optional offline summary, Twitch clips; later Kick and
  TikTok live if the user streams there.
- **Welcome + member onboarding** (Dyno/MEE6): auto-roles on join (separate for
  bots), welcome and goodbye messages with variables and an optional image
  card, DM welcome, rules-accept/verification button gate with a role.
- **Role panels** (Carl): reaction, button and select-menu roles, grouped,
  with unique-choice groups, temporary roles and a role-limit per user.

Tier B, community features people expect from MEE6/Carl:
- **Leveling/XP** (MEE6): XP per message (cooldown) and per minute in voice,
  levels, role rewards, no-XP channels and roles, XP boosts, leaderboard (also
  on a public dashboard page), rank card image, import from MEE6's export.
- **Announcements** (phase 5), **YouTube uploads** (phase 6), **webhooks** (phase 7).
- **Tickets**: panel with a button, private channel or thread, claim, close
  with transcript saved to the dashboard, categories, staff roles.
- **Giveaways**, **polls**, **suggestions** (up/down vote, staff approve/deny
  with a reason), **starboard**, **birthdays** (role + announcement),
  **reminders** (`/remind`), **counting channel**, **stat counter channels**
  (members, online, boosts), **sticky messages**, **auto-publish** in
  announcement channels, **custom commands / auto-responders** (Carl tags).
- **Temp voice extras** (VoiceMaster): remember a member's room settings (name,
  limit, locked) for their next room, per-role max channels and bitrate,
  voice-text chat cleanup, AFK handling, voice-time leaderboard.

Tier C, polish and operations:
- Utility commands (`/userinfo`, `/serverinfo`, `/roleinfo`, `/avatar`,
  `/afk`, `/embed` builder), a **public help command** listing only what the
  member may use, per-command and per-channel permission overrides in the
  dashboard, a **Modules** page (every feature on/off), a dashboard **audit
  trail** (who changed which setting), config backup/export, German and English
  bot replies (cookie language for the dashboard, server language for the bot),
  GDPR tools (delete a member's data, retention jobs).
- Basic **automod** (blocked words, invite links, mass mentions, caps, repeated
  messages) is *not* the pattern-based anti-bot and not started: ask the user
  before touching it, since it overlaps with the skipped anti-bot work.

Proposed order after the current queue (redesign → Twitch): moderation rest +
more logs → welcome/auto-roles/role panels → announcements → leveling →
YouTube → tickets → the Tier B bundle → webhooks → Tier C.

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
`DATABASE_SCHEMA`, `BOT_API_SECRET`, `BOT_API_PORT`, `BOT_API_HOST` (optional:
127.0.0.1 locally, 0.0.0.0 when `BOT_ENV=production`), `TOKEN_ENCRYPTION_KEY`,
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
- **pnpm on this machine**: incremental installs are unreliable. After editing a
  `package.json`, `pnpm install` may say "Already up to date" without linking, and
  `pnpm install --force` can leave dangling links. A **clean install** (delete
  every `node_modules`, then `pnpm install`) is deterministic (~2 min). Stop the
  bot and dev servers first, they hold files open. The dashboard has no vitest of
  its own (pnpm records it without its peers and links a folder that doesn't
  exist): `pnpm --filter @aboutselphy/dashboard test` runs through the bot's
  vitest with `--root`, and `*.test.ts` is excluded from the dashboard's `tsc`.
- The generated Prisma client (`packages/db/src/generated`) is gitignored and a
  branch switch can wipe or half-wipe it. `ensure-client` (bot `predev`/`prestart`)
  regenerates it; `pnpm --filter @aboutselphy/db generate` always starts clean.
- Local login needs `../Auth` running on `:3000` with `http://localhost:3004` in its
  `TRUSTED_ORIGINS` (its cookie is host-only on localhost), and a valid
  `DISCORD_CLIENT_SECRET` there. `invalid_client` from Discord at the callback
  means that secret is stale (reset in the Developer Portal), not that our
  `DISCORD_APP_ID` is wrong (the client ID is the application ID).
- `next dev` writes `apps/dashboard/AGENTS.md` and a `CLAUDE.md` importing it;
  they are committed, like in Main.
- The bot exits if Discord can't be reached at startup (one 10 s connect
  timeout was enough). Production relies on the container restart policy; a
  login retry with backoff is a small TODO.
- **After a Prisma schema change, restart the bot and the dashboard dev server.**
  A running process keeps the client it loaded at start (`pnpm --filter
  @aboutselphy/db generate` only rewrites files). Symptom: `Cannot read properties
  of undefined (reading 'findUniqueOrThrow')` for a model that exists in the
  schema, shown on the dashboard as the generic "Couldn't load this page". The
  real error is in the dev server's log; the page deliberately never shows it.
- **Never put backticks (or `$(...)`) in a shell string**, e.g. a `node -e "..."`
  that writes Markdown: the shell runs them as commands and silently eats the
  text between. Edit docs and code with the editor tool, not with shell one-liners.
- Moderators' dashboard rights: Settings is hidden from them in the nav, and the
  page and `saveSettingsAction` enforce admin anyway.

## Verified so far (2026-10-08, no live Discord/DB/auth available)

- `pnpm typecheck` passes in all four packages; the dashboard builds with no
  env (lazy clients) and `pnpm lint` is clean.
- Dashboard on a **production build**: signed-out `/` redirects to the auth
  login with the right return URL, CSP + nonce and all static headers are on the
  response, `/api/bot/status` returns 401 without a session, `/api/health` 200.
- Bot: env validation names missing variables, the token never appears in logs.
- **Verified live (2026-10-10)**: migrations applied to the real database
  (schema `bot`, role `aboutselphy_bot`, checked with `pnpm --filter
  @aboutselphy/db check`); the bot logs in on the real server, registers its 11
  commands, `/health` is ok; the user tested the moderation commands in Discord
  and reports everything works. There is **no dev bot and no `bot_dev` schema**
  (decided 2026-10-10): local runs use the real token and database, so be
  careful with commands that act on real members. Integration tests refuse the
  `bot` schema; run them against a throwaway Docker Postgres.
- **Integration tests** (10, `repository.integration.test.ts`) ran against a
  Docker Postgres 18.6: gap-free case numbering under parallel inserts, counter
  rollback on a failed insert, every CHECK constraint.
- **Docker** (2026-10-10): the bot image builds from a fresh clone and starts
  (as `node`, env validated, DB reachable). The dashboard image did **not** build
  yet: npm registry timeouts inside Docker, not a Dockerfile error. A pnpm store
  cache mount and `.npmrc` retries are on `chore_dockerfiles`, which stays off
  `main` until a fresh-clone dashboard build succeeds.
- **Dashboard verified live (2026-10-10, by the user)**: login through the local
  Auth service, overview, cases list/search/detail, pardon, settings and the
  channel picker all work. Internal API checked: bearer required, 8 KB JSON
  bodies, loopback-only outside production.
- **Security review of the dashboard branch (2026-10-10, manual: the
  `security-review` skill needs a git remote, `origin/HEAD`)**: no tracked
  secrets, no raw HTML rendering, every action/route guarded (public on purpose:
  `/api/health`, the language switch which validates against an allow-list);
  one finding fixed (internal API bound to all interfaces locally).
- **Not verified yet**: the dashboard Docker image, the audit-log capture event
  in Discord (user to confirm), and a moderator-role (non-admin) login.

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
        command definitions are unit-tested; the DB paths have integration
        tests and the commands were tried live by the user (2026-10-10).
        Slash commands are only visible to staff by code check
        (`requires`), Discord's default permissions are just a UI hint.
  - [x] Audit-log capture (2026-10-09, `feature_moderation-audit-log`):
        `guildAuditLogEntryCreate` turns kicks, bans, unbans and timeout
        set/clear done in Discord's UI (or by other tools) into `audit_log`
        cases and posts them to the log channel. The bot's own actions are
        skipped by executor id (they already have a case), so there is no
        dedupe window to get wrong. Needs the `GuildModeration` intent (not
        privileged, now in `INTENTS`) and the bot's **View Audit Log**
        permission. Mapping is pure and tested (`caseFromAuditEntry`, 7 tests);
        the live event is untested. Not captured yet: AutoMod timeouts, and
        timeouts by Discord itself.
  - [x] Dashboard (2026-10-10, `feature_dashboard-moderation`): overview (last 7
        days, active warnings, latest cases, bot status), `/cases` (filter by
        action, search by name / user ID / reason / case number, filter in the
        URL, pagination), `/cases/[number]` (detail, other cases for the
        member), **pardon warning** (any staff; one conditional UPDATE, records
        who and when in `pardonedAt/ByUserId/ByName`, then the bot edits the log
        embed), `/settings` (admin: log channel picker in Discord's own order
        with category headings, DM toggle; the channel is validated against the
        bot's list). The dashboard never talks to Discord: the bot's internal API
        gained `GET /internal/guild/channels` and `POST
        /internal/moderation/refresh-case`.
  - [x] Channel tools (2026-10-12, `feature_moderation-tools`, **tried live by the
        user**): `/purge` (count, optional member or bots, skips pinned and
        anything older than the 14-day bulk-delete limit, scans at most 500
        messages; `purge.ts` is pure and tested), `/slowmode` (duration or off,
        max 6 h), `/lock` and `/unlock` (only @everyone's SendMessages,
        SendMessagesInThreads and CreatePublicThreads; unlock resets to inherit).
        They create no cases; each posts a note to the mod log (`postModNote`).
        Each checks the bot's permissions in the target channel first.
  - [x] Temporary bans and warning escalation (2026-10-12,
        `feature_moderation-scheduler`; migrations `..._moderation_scheduler` and
        `..._escalation_window` applied; **not tried live yet**): `/ban duration:3d`
        stores the expiry on the ban case; `jobs.ts` lifts due bans at startup and
        every minute (claims each atomically with `expiryHandledAt`, retries on
        failure, notices a hand-lifted ban, records an `unban` case from "system";
        only runs in production or with `BOT_INTEGRATIONS_IN_DEV`). Escalation
        (`escalation.ts`, pure and tested): every N-th active warning (optionally
        only those of the last 1-365 days) applies a timeout, kick or (temporary) ban
        as the bot, recorded as an `automod` case; `/modlog escalation` and
        `/modlog escalation_off`, and a section on `/settings` (admin). A CHECK in the
        database keeps the settings consistent. Duration helpers live in
        `@aboutselphy/shared/duration` (bot and dashboard parse identically).
  - [ ] Roles re-applied when a member rejoins (needs the GuildMembers intent),
        warn/timeout/ban from the dashboard, case notes editing
  - [ ] More log types (message edit/delete, joins/leaves, voice)
  - [ ] Case notes editing, a per-member history page, and dashboard-issued
        actions (warn/timeout from the dashboard)
- [ ] Phase 2 — anti-bot
- [x] Phase 3 — went live (2026-10-12, `feature_twitch-went-live`; migrations
      `20261012120000_twitch` and `20261012180000_twitch_message_options` applied;
      connect, add/edit and the socket **tried live by the user**; a real
      announcement of a stream going live is not confirmed yet)
  - Bot (`modules/twitch/`): `protocol.ts` (zod-parsed EventSub frames, reconnect
    URLs only on `*.wss.twitch.tv`, message-id de-dup), `eventsub-client.ts` (the
    socket: welcome → subscribe within the 10 s budget, keepalive timeout +5 s
    slack, `session_reconnect` handoff without resubscribing, exponential
    backoff; uses Node's built-in `WebSocket`, no `ws` dependency; 8 tests with a
    fake socket), `helix.ts`, `tokens.ts` (access token in memory, refresh token
    encrypted in `TwitchConnection`, rotated token always stored, a rejected
    grant sets `needsReconnect`), `reconcile.ts` (pure plan after every
    (re)connect: late announcement only for a known channel and a stream younger
    than 15 min, otherwise a **silent baseline** row with `messageId` null; stale
    open rows closed), `notification.ts` (escaped message, Twitch-CDN-only
    thumbnail, only the configured role can ping), `service.ts` (announce is
    serialised per stream id and unique in the DB, offline edits the message),
    `/twitch add|remove|enable|disable|status` (admin). Off in local runs unless
    `BOT_INTEGRATIONS_IN_DEV=true`, and without `TWITCH_CLIENT_ID/_SECRET` +
    `TOKEN_ENCRYPTION_KEY`.
  - Dashboard `/twitch` (admins): connect/disconnect, the two switches, the
    channels (pause/remove). Adding channels is only `/twitch add` for now (the
    login must be resolved through Helix, which only the bot has a token for).
    Connect flow = `/api/twitch/connect|callback` (state cookie, admin only,
    outcome as a code). The grant asks for **no scopes** (stream.online/offline
    need none). **Never revoke the access token after connecting**: Twitch ends
    the whole grant, refresh token included. Revoking is only for disconnect.
  - Shared: `@aboutselphy/shared/token-cipher` (Node only, key passed in) and
    `TWITCH_REFRESH_TOKEN_PURPOSE`.
  - To go live: put `TWITCH_CLIENT_ID/_SECRET` + `TOKEN_ENCRYPTION_KEY` in
    `.env.local`, register the redirect URL for the Client ID, apply the
    migration (only with the user's go-ahead), restart bot and dashboard, connect
    on `/twitch`, `/twitch add`, `/twitch enable`.
  - Add/edit from the dashboard (dialog on `/twitch`): the login is looked up
    through the bot (`POST /internal/twitch/resolve`, the bot holds the Twitch
    token), roles come from `GET /internal/guild/roles`; the Discord channel and
    role are validated against the server, a sixth channel is refused
    (`MAX_TWITCH_STREAMERS = 5`: one WebSocket allows a subscription cost of 10 and
    online + offline cost 1 each per channel).
  - Per channel: message template (`{name} {login} {title} {game} {url}`), embed
    colour, show game, show stream picture. The template function lives in
    `@aboutselphy/shared/twitch-template` and is used by the bot **and** the
    dashboard's live preview, so they can't drift apart.
  - Lessons: in next-intl catalogs a literal `{name}` must be written `'{name}'`,
    otherwise the key is shown raw. After a schema change restart bot **and**
    dashboard (a stale client throws `PrismaClientValidationError` on save).
  - [ ] Kick/TikTok, clips, a "Live" role, more than 5 channels (second connection).
- [~] Phase 4 — temporary voice channels
  - [x] Lifecycle (2026-10-10, `feature_tempvoice-lifecycle`, **tried live by
        the user**): `TempVoiceConfig` (singleton, switched off by default) and
        `TempVoiceChannel` (one row per room the bot made). Joining the lobby
        creates a room named from the template (`{user}'s room`) and moves the
        member in; joining again returns them to their own room; the room is
        deleted when no human is left (a bot staying behind doesn't count); only
        channels with a row are ever deleted, never the lobby; rooms are
        reconciled at startup and after a gateway resume; a room deleted by hand is
        forgotten. Events per room are serialised (`KeyedMutex`), creation has a
        5 s per-member cooldown. Admin command `/tempvoice lobby|category|name|
        limit|enable|disable|status` checks the bot's View Channel, Manage
        Channels, Move Members and Connect where rooms live. Needs the
        `GuildVoiceStates` intent (not privileged). The room's live state (locked,
        limit, video, soundboard, allow-list) is the Discord channel itself, not
        the database.
  - [x] Controls (2026-10-10, `feature_tempvoice-controls`, **tried live by the
        user**): a panel posted in each room's chat (one button row + four user
        selects) and `/voice` (info, panel, name, limit, lock, unlock, video,
        soundboard, allow, remove, kick, block, unblock, transfer, claim), open to
        **every member** on purpose: no `requires`, no hidden default permissions.
        The boundary is `controller.ts`: each action first checks the person is
        the room's owner or staff (`canManageRoom`), and `checkTarget` stops an
        owner turning the controls on moderators, the server owner or themselves.
        `claim` only works for someone inside the room while the owner is not.
        Room state is derived from the channel's permission overwrites
        (`deriveRoomState`), so the panel can't disagree with Discord. Owners
        never hold Manage Channel: the bot changes things for them. Renames are
        limited to Discord's 2 per 10 minutes (`SlidingWindowLimiter`), else
        discord.js queues the request and the button hangs. Buttons, selects and
        modals are routed by custom-ID prefix (`events/components.ts`, `tv:...`,
        strict parse). Needs the bot to send messages and embeds in the voice
        channels' chat.
  - [x] Blocklist (2026-10-11, `feature_tempvoice-blocklist`): room names (new
        rooms, renames, the `/tempvoice name` template and the dashboard's
        template) are checked against the admin's own words and a **built-in list
        of common insults and slurs, English and German** (`packages/shared/src/
        profanity.ts`, on by default, `TempVoiceConfig.useDefaultBlocklist`).
        Patterns are built in code from plain words, never from user input; each
        matches a **whole word** only (no Scunthorpe problem: "assassin", "class",
        "cockpit", "shiitake", "Niger" are fine, tested), sees through `sh1t`,
        `f*ck`, `fuuuck`, `f.u.c.k`, invisible characters, fullwidth and
        look-alike Cyrillic/Greek letters, and `ß`/umlauts; every letter run is
        one quantified class so hostile input stays linear (tested), input is
        capped at 500 characters. Admin words stay **literal substrings** (no
        regex from the dashboard: arbitrary patterns need `re2`, to come with
        the anti-bot engine). A blocked display name makes the room "Voice room"
        instead of failing; a refused rename never echoes the word. To extend
        the list, add an entry to `ENGLISH`/`GERMAN` and a catch + a
        false-positive case to `profanity.test.ts` (slurs are assembled from
        fragments there). Mild words (damn, hell, crap) are deliberately out.
  - [x] **Multiple lobbies** (2026-10-11, `feature_tempvoice-multi-lobby`): up to
        10 lobbies (`MAX_TEMP_VOICE_LOBBIES`), each a row in `TempVoiceLobby` with
        its **own** category, name template, member limit, video/soundboard
        defaults and on/off; the master switch, blocked words and built-in list
        stay in `TempVoiceConfig`. Joining any switched-on lobby creates a room
        from that lobby's settings (`planTransition` returns `createFromLobby`);
        a member still gets **one room at a time**, whichever lobby they use; a
        configured lobby is never deleted as an "empty room". Rooms remember
        their lobby (`TempVoiceChannel.lobbyChannelId`, no foreign key, so removing
        a lobby leaves open rooms alone). `/tempvoice` is now `lobby add|set|
        remove`, `enable`, `disable`, `status`. The migration **copies the old
        single lobby into the new table before dropping the old columns** (the
        generated script dropped them first); it was rehearsed on the real data in
        a rolled-back transaction. Dashboard: rooms grouped by lobby, a lobby
        manager (add/edit/remove in a dialog; the channel is fixed once created, to
        move a lobby remove + add), and a general-settings form. Saving a lobby
        checks the channel is a voice channel and the category a category the bot
        sees, that it isn't already a lobby or a room, the 10-lobby cap and that the
        template isn't blocked. Client components must not import
        `@aboutselphy/shared`'s index (it carries the word list): constants are
        passed down from the server page.
  - [x] Dashboard (2026-10-11, `feature_dashboard-tempvoice`, admins only):
        `/voice-rooms` with a **live view** of the open rooms (owner, who is in
        them, locked/open, limit, video and soundboard off, let-in/blocked counts,
        age; polled every 8 s from the bot's `GET /internal/tempvoice/overview`,
        read from the gateway cache, plus a warning when the bot lacks
        permissions for the lobby's category) and the **settings form** (on/off,
        lobby, category, name template, default limit, video/soundboard defaults,
        blocked words). Saving validates the lobby is a voice channel and the
        category a category the bot can see, refuses channel changes while the
        bot is unreachable, then asks the bot to reload (`/internal/reload/
        tempvoice`).
- [x] Dashboard redesign (2026-10-11, `feature_dashboard-redesign`): same palette,
      new look. Utilities `surface` / `surface-interactive` (glass card, blur,
      inner highlight) and an ambient brand glow live in `globals.css`. Desktop:
      floating sidebar with grouped pill navigation (`navFor()` in
      `components/shell/nav.ts`), a bot status pill and the account block
      (avatar, role badge). Phone: slim top bar + account bottom sheet + tab bar.
      `useBotStatus` (client hook, 15 s poll) feeds the pill and the status
      card. The CSP's `img-src` allows `https://cdn.discordapp.com` for avatars.
      Use `surface` for any new card, not `border bg-card`. Looked at by the
      user before merge: pending feedback.
- [x] Phase 5 — announcements (2026-10-13, `feature_announcements`, migration
      `20261013100000_announcements` applied; **not tried live yet**)
  - `Announcement` table (draft/scheduled/sending/sent/failed, text, optional embed
    with colour and https picture, channel, one ping role, schedule, the posted
    message id) with CHECKs. Bot (`modules/announcements/`): `message.ts` builds the
    message (staff markdown kept, **only the configured role can ping**), `service.ts`
    posts due rows every 30 s and when the dashboard nudges
    (`POST /internal/reload/announcements`), claims each atomically (never twice),
    marks a send interrupted by a restart as **failed** instead of repeating it,
    `POST /internal/announcements/edit|delete` change the Discord message. Off in a
    local run without `BOT_INTEGRATIONS_IN_DEV`.
  - Dashboard `/announcements` (moderators and admins): list with status and a plain
    failure reason, composer dialog with a Discord-style preview (the picture is
    only a box: the dashboard never loads staff-typed addresses), send now / schedule
    / draft, edit (a sent one is edited in Discord), delete (a sent one is deleted
    from Discord first). Channel and role are validated through the bot; rules in
    `@aboutselphy/shared/announcement` are used by the form, the Server Action and
    the bot.
  - [ ] Templates, several embeds or fields, recurring announcements, auto-publish
        in announcement channels
- [ ] Phase 6 — new video upload
- [ ] Phase 7 — webhooks
