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
- **The bot's own role** ("managed by an integration") is created by Discord from the permissions in
  the invite link, the bot can't create it. `pnpm --filter @aboutselphy/bot invite-url` prints the link
  with every permission the features need; opening it again for a bot already in the server updates
  the role without kicking anything. Administrator and Mention Everyone are left out on purpose.
- **Logo** (2026-10-22, `chore_branding`): the chibi picture the user sent. The one source is
  `apps/dashboard/public/brand/logo-source.png` (128 px). `pnpm --filter @aboutselphy/bot brand`
  rebuilds `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `public/brand/logo.png` (sidebar and
  mobile bar) and `bot-avatar.png`; `pnpm --filter @aboutselphy/bot set-avatar` pushes the avatar to
  Discord through the REST API (rate-limited, run it once). Replace the source with a bigger picture
  for crisper icons and run both again.
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
- **Hardening and no-index** (2026-10-26, `chore_security-hardening`): every dashboard response (pages,
  errors, `/api`, static files) carries `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet,
  noimageindex, noai, noimageai`; `robots.txt` disallows everything (plus named AI crawlers) and the
  `<meta>` robots tag says the same. Added `Cross-Origin-Resource-Policy: same-origin`,
  `Origin-Agent-Cluster`, `X-DNS-Prefetch-Control`, `X-Permitted-Cross-Domain-Policies` and a longer
  Permissions-Policy; Server Actions only accept the host of `NEXT_PUBLIC_SITE_URL`
  (`allowedOrigins`). The compose services drop all Linux capabilities, forbid new privileges, run an
  init process and cap processes. Verified on a production build. `next` and `eslint-config-next` are
  pinned to 16.3.8 (fixes seven advisories incl. an image-optimizer SSRF). `pnpm audit --prod` still
  lists `deepmerge-ts` 7.1.5 inside Prisma 7.10.0's config loader (it only merges our own config files,
  no untrusted input): accepted until Prisma moves it, re-check at every Prisma bump.
- **Terms of Service and Privacy Policy** (2026-10-27, `feature_legal-pages`): public pages `/terms` and
  `/privacy` (English and German, by the visitor's language), the only dashboard routes readable without
  signing in (`lib/public-paths.ts`, an exact allow-list used by `proxy.ts`; they keep the nonce CSP, the
  security headers and the no-index header). The text is structured data in `modules/legal/` (rendered as
  plain text, no markup) and was written from what the code really stores: moderation cases, levels,
  tickets and transcripts, birthdays (day and month only), reminders, suggestions/polls/giveaways,
  starboard, role snapshots (90 days), counting, message text read live but not stored. **Keep it in sync**:
  when a feature starts storing something new or a retention changes, edit `privacy.en.ts` AND
  `privacy.de.ts` (the test checks both have the same sections) and bump `LEGAL_LAST_UPDATED` in
  `modules/legal/types.ts`. The operator's details come from `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_ADDRESS`,
  `LEGAL_CONTACT_EMAIL`, `LEGAL_COUNTRY`, `LEGAL_HOSTING` (dashboard env, compose, `.env.example`); an unset
  value shows as a visible `[LEGAL_... is not set]` placeholder, never a guess. **Not legal advice**: have a
  lawyer or the data protection officer check the wording before relying on it; a German operator with
  income from the community (Twitch, sponsors) may also need an Impressum. The bot is **single-server**:
  the texts say so; if it ever becomes multi-server the documents and the code need real changes (per-server
  data separation, a processor agreement, retention tools). Known gaps the policy words carefully: there is
  **no automatic retention** for moderation cases, ticket transcripts, suggestions, levels and starboard
  posts (deleted on request by hand), and no self-service "delete my data" command yet.
- **Docker / Dokploy** (2026-10-26, `chore_dockerfiles-v2`): `docker-compose.yml` at the repo root starts
  both services: `dashboard` (applies migrations on start, healthcheck `/api/health`, `expose 3000`, the
  Dokploy domain goes on this service) and `bot` (waits for a healthy dashboard, no ports, internal API on
  the compose network at `http://bot:3100`, `BOT_ENV=production`). Required variables fail fast
  (`${VAR:?}`); everything else is in `.env.example`. The Dockerfiles (`apps/*/Dockerfile`, build context =
  repo root) come from the earlier `chore_dockerfiles` branch plus: the dashboard also transpiles
  `@aboutselphy/db` and copies `public/`. **The images were NOT built or run to the end here** (the npm
  registry was very slow from inside Docker and the user stopped the test): the first Dokploy build is
  the real test. Things to watch: `@napi-rs/canvas-linux-x64-musl` must install on alpine for the cards,
  and the dashboard needs `NEXT_PUBLIC_SITE_URL` as a build argument.
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
  - [x] Server logs (2026-10-16, `feature_logs`, migration `20261016100000_logs` applied;
        **not tried live yet**): four kinds, each with its own channel and switch
        (`LogRoute`, dashboard `/logs`, admins): **members** (joins with account age and a
        warning under 7 days, leaves with roles), **memberUpdates** (nickname, role changes;
        role changes within 20 s of a join are skipped, those are auto-roles), **voice**
        (join/leave/move; mutes and camera not logged), **server** (channels and roles
        created/deleted/renamed, role permission or colour changes). Entries are built from
        plain data (`embeds.ts`, tested): people as mention + raw id, every name escaped, no
        pings. Routes cached 60 s + reload. Only runs in production or with
        `BOT_INTEGRATIONS_IN_DEV`. Moderation actions keep their own log (`/modlog`).
  - [x] **Message logs** (2026-10-24, `feature_message-content`, migration `20261024180000_log_messages`
        only loosens the `LogRoute` CHECK; **not tried live yet**): a fifth kind `messages` (own channel and
        switch on `/logs`): deleted messages (author, text and attachment names when the bot still has
        them cached, else a note that they weren't saved), edits (text before and after; only real text
        changes, not link previews), bulk deletes (a count). Bots, the log channels themselves and open
        ticket channels are never logged. Each line is escaped on its own so breaks stay, nothing pings.
        Registered only when `DISCORD_MESSAGE_CONTENT=true` (the privileged intent is **on** since
        2026-10-24, flag added to `.env.local` and documented in `.env.example`; ticket transcripts work
        with it too). Invite tracking (GuildInvites intent) is still open.
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
    role are validated against the server. Up to `MAX_TWITCH_STREAMERS = 30` channels
    (2026-10-27): the first 5 (`MAX_TWITCH_EVENTSUB_STREAMERS`, one WebSocket allows a
    subscription cost of 10 and online + offline cost 1 each) get instant EventSub events;
    the rest are checked by `pollExtra` once a minute through Helix (`reconcile` limited to
    those channels, so an announcement can be up to a minute late and there is no race with
    events). Not tried live yet.
  - Per channel: message template (`{name} {login} {title} {game} {url}`), embed
    colour, show game, show stream picture. The template function lives in
    `@aboutselphy/shared/twitch-template` and is used by the bot **and** the
    dashboard's live preview, so they can't drift apart.
  - Lessons: in next-intl catalogs a literal `{name}` must be written `'{name}'`,
    otherwise the key is shown raw. After a schema change restart bot **and**
    dashboard (a stale client throws `PrismaClientValidationError` on save).
  - **Live role** (2026-10-21, `feature_twitch-live-role`, migration `20261021180000_twitch_live_role`
    applied; **not tried live yet**): `TwitchConfig.liveRoleId` (one role, picked on `/twitch`) and
    `TwitchStreamer.discordUserId` (the Discord member linked to a channel, checked to be in the
    server on save through `GET /internal/guild/member`). The linked member wears the role while the
    channel is live (`twitch/live-role.ts`, every change through `checkRole`); it is given on
    `stream.online`, taken off on `stream.offline`, repaired from Helix on every (re)connect, and
    removed from paused channels. A failure is logged and never blocks the announcement.
  - **Fix 2026-10-28** (`fix_twitch-poll-first-stream`): the very first stream of a freshly added channel was
    baselined silently (no history yet), which for polled channels (no events) meant no announcement and only the
    live role. `reconcile` now treats a stream as new when the channel was added **before it started**
    (`addedBeforeStart`); a channel added while already live is still baselined. Not tried live yet.
  - [ ] Kick/TikTok, clips, more than 30 channels.
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
  - **Navigation groups** (2026-10-27, `feature_nav-categories`; the long "Content and automation" heading wrapped badly and was shortened to "Content" on 2026-10-28; keep headings to one short line): `NAV` in `nav.ts` has seven
    headed groups (moderation, members and roles, engagement, voice, content and automation,
    streams and feeds, system) after the heading-less overview. Add a page to the group where
    an admin would look for it (`nav.test.ts` checks: every page once, 2-7 items per group,
    the exact moderator list, names in en and de). The desktop sidebar groups collapse; the
    group with the current page is open by default, hand changes are kept in `localStorage`
    (`nav-groups`). The phone "More" sheet builds from the same groups.
  - **Catalog keys never contain a dot** (next-intl reads it as nesting and throws
    INVALID_KEY on every page): `catalogs.test.ts` enforces this and equal en/de keys.
- [~] Moderator guide (2026-10-28, `feature_mod-guide`, migration `20261028100000_mod_guide`; **not tried live
      yet**; asked for by the user)
  - Admin page `/mod-guide`: channel, title, description, cover picture (https only, shown big on the first
    embed), colour, optional "Good to know" section; the **Post / Update** button asks the bot
    (`POST /internal/modguide/post`) to post the guide, and later presses **edit the same messages** (ids kept in
    `ModGuide.messageIds`, extra ones deleted, a changed channel starts fresh). It never posts by itself.
  - The command list is **read from the registered commands** when posting (`modules/modguide/rules.ts`): every
    command with `requires: "moderator"` plus `/ticket` (team-only inside its code), not `/ping`, each as its usage
    (`/ban <user> <reason> [duration]`, sub-commands as `/suggestion approve|deny|implement`) and its description,
    escaped. Categories: acting on members, cases and history, channel tools, community, and "Other" for any new
    moderator command not mapped yet (**add it to `CATEGORIES`** when you add one). Embeds are packed into as few
    messages as fit Discord's limits (10 embeds, 6000 characters). Nothing can ping (`allowedMentions: parse []`).
    The dashboard preview comes from `GET /internal/modguide/preview`. Tests in `rules.test.ts`.
- [~] Leveling (2026-10-16, `feature_levels`, migration `20261016180000_levels` applied;
      **not tried live yet**; Tier B of the replacement roadmap)
  - Bot (`modules/levels/`): message XP (random in a range, per-member cooldown kept in
    memory), voice XP once a minute (needs someone else in the channel, not deafened, not the
    AFK channel), curve = MEE6 `5n²+50n+100` (`@aboutselphy/shared/levels`, tested),
    no-XP channels/categories/roles, atomic increments (`MemberXp`), level-up: reward roles
    (`planRewardRoles` stack/highest-only, **every role through `checkRole`**) and an
    announcement (off / same channel / one channel; voice level-ups only in the one-channel
    mode). `/rank` (canvas rank card, falls back to text), `/leaderboard`, `/xp
    add|remove|set|reset` (admin; re-syncs reward roles). Uses the **GuildMessages** intent
    only: message text is never read. Runs only in production or with
    `BOT_INTEGRATIONS_IN_DEV`. Shared drawing helpers: `lib/canvas.ts`, `lib/avatar.ts`.
  - Dashboard `/levels` (admins): all settings, the reward list, no-XP pickers, top 25.
  - [ ] XP boosts per role, a public leaderboard page, importing MEE6 data, weekly resets,
        voice XP only counting unmuted time.
- [~] Tickets (2026-10-17, `feature_tickets`, migration `20261017100000_tickets` applied;
      **not tried live yet**; Tier B)
  - Bot (`modules/tickets/`): panel message with an "Open a ticket" button; opening
    (serialised per member via `KeyedMutex`, `maxOpenPerUser`) creates a private channel
    in the configured category visible only to the opener, the staff roles and the bot
    (`ticketOverwrites`, pure, tested: the opener never gets Manage Channel/Messages). Claim
    (staff) and Close (opener or staff, with a confirm step). Close = one conditional UPDATE
    (`markClosed`), transcript, summary + `.txt` transcript in the log channel, opener's
    writing locked, channel deleted after 10 s. Control ids `tk:open`,
    `tk:close|confirm|claim:<id>`, strict parse; the ticket must exist, be open and be pressed
    in its own channel. A channel deleted by hand closes its ticket; startup reconciles both
    ways. `/ticket add|remove` (team). Ticket numbers come from `TicketConfig.nextNumber`
    (atomic; a failed open leaves a gap).
  - **Transcripts need the privileged MessageContent intent**: opt in with
    `DISCORD_MESSAGE_CONTENT=true` (adds the intent in `client.ts`) once it is switched on in
    the Developer Portal; without it tickets work and say "no transcript saved". The saved JSON
    (`transcriptSchema`, <= 2000 messages, <= 4000 chars each, attachment links only from
    Discord's CDN) is parsed again before the dashboard shows it, as plain text.
  - Dashboard `/tickets` (all staff: list + transcript page `/tickets/[number]`; admins:
    settings, post/update panel). `components/form/multi-picker.tsx` is shared.
  - [ ] Ticket categories/topics, a reason prompt when opening, rating, auto-close of
        idle tickets, claiming limits.
- [~] Giveaways (2026-10-18, `feature_giveaways`, migration `20261018100000_giveaways`
      applied; **not tried live yet**; Tier B)
  - Bot (`modules/giveaways/`): draft -> active (posts the message with an Enter button),
    active -> ended (draw), each a **single conditional UPDATE** so nothing happens twice; a
    30 s round (`endDue`) ends due giveaways, so a restart only delays an ending. Entering
    checks: running, before its end, pressed on its own message, required role (read now), not
    a bot; pressing again withdraws. At the draw, entries are filtered again (still in the
    server, still holding the role, not a bot) and `pickWinners` (unbiased partial Fisher-Yates,
    tested for uniformity) picks them; re-roll prefers new people; only the winners are pinged;
    prize and text are escaped. One internal endpoint `POST /internal/giveaways/action`
    (start/end/reroll/cancel). Runs only in production or with `BOT_INTEGRATIONS_IN_DEV`.
  - Dashboard `/giveaways` (all staff): list, create/edit drafts, start, end now, re-roll,
    cancel, remove. A giveaway that can't be posted stays a draft with the reason.
  - **Picture**: giveaways have the same optional `imageUrl` (see Polls).
  - [ ] Weighted entries (e.g. extra for boosters), entry requirements beyond a role, recurring
        giveaways, a `/giveaway` slash command.
- [~] Suggestions (2026-10-19, `feature_suggestions`, migration
      `20261019100000_suggestions` applied; **not tried live yet**; Tier B)
  - Bot (`modules/suggestions/`): `/suggest` (cooldown, 5-1500 chars), post with up/down
    buttons (`sg:up|down:<id>`, strict parse; one vote per member, same button again takes it
    back, the author can't vote on their own idea, voting closes when decided; post edits for
    votes are debounced 1.5 s), `/suggestion approve|deny|implement` (team) or the dashboard:
    `canTransition` (open -> any decision, approved -> implemented) + one conditional UPDATE,
    the post is edited and the author gets a DM. Author text is escaped, nothing pings.
    Numbers from `SuggestionConfig.nextNumber` (atomic).
  - Dashboard `/suggestions` (all staff: list, filter, decide; admins: settings).
  - [ ] Staff-only comments on a suggestion, merging duplicates, a leaderboard of ideas.
- [~] Polls (2026-10-19, `feature_polls`, migration `20261019180000_polls` applied; **not tried
      live yet**; Tier B)
  - Bot (`modules/polls/`): `/poll question options duration multiple` (team; options split
    on `|`, 2-10, 80 chars each), post with one button per option (`pl:v:<id>:<n>`, strict
    parse; single choice replaces the vote, same button withdraws it, multiple choice toggles;
    votes are anonymous, only counts show; post edits debounced 1.5 s). A poll is a draft until
    started (conditional UPDATE draft -> active), ended by a 30 s job at its end time or by
    staff (conditional UPDATE active -> ended); the ended post disables the buttons and marks
    the winner. Question and options are escaped, nothing pings. `POST /internal/polls/action`
    (start|end|delete).
  - Dashboard `/polls` (all staff): create (options one per line, channel, optional end,
    multiple choice), live results with bars, start a draft, end now, remove (not while running).
  - [ ] Editing a draft, a results chart over time, reminders before it ends.
  - **Picture** (2026-10-22, `feature_giveaway-poll-images`, migration `20261022180000_giveaway_poll_images`):
    `imageUrl` on polls and giveaways (https only, shared `isAllowedImageUrl`, a DB CHECK, re-checked by the
    bot), shown big in the post; the dashboard forms and `/poll image:` take the address.
- [~] Starboard (2026-10-20, `feature_starboard`, migration `20261020100000_starboard`
      applied; **not tried live yet**; Tier B)
  - Bot (`modules/starboard/`): one unicode emoji (default star) and a threshold of 1-25
    reactions; at the threshold the message is re-posted in the showcase channel (embed with the
    escaped text, first image from Discord's CDN only, jump link, `emoji **n** | #channel`), the
    count is **recomputed from Discord on every reaction** (never incremented, so a missed event
    heals), reactions are handled one message at a time (`KeyedMutex`). Bots never count, the
    author only with `allowSelf`. Below the threshold the re-post is removed; deleting the
    original removes the re-post; deleting the re-post by hand lets the next star post it again.
    Age-restricted channels and the showcase channel itself are ignored. Message text needs the
    Message Content intent (`DISCORD_MESSAGE_CONTENT=true`); without it the re-post still shows
    the author, attachments and the jump link.
  - Dashboard `/starboard` (admins): settings and the most starred messages.
  - [ ] Custom server emoji, a channel ignore list, a random-star command, a per-member count.
- [~] Sticky messages (2026-10-23, `feature_sticky-publish`, migration `20261023180000_sticky_publish`
      applied; **not tried live yet**; Tier B)
  - Bot (`modules/sticky/`): up to 10 channels, each with a staff-written text kept at the bottom as
    an embed. A message from anyone but the bot starts a 3 s quiet timer, then the bot deletes its
    old copy and posts again, one channel at a time (`KeyedMutex`); `dirty` marks a dashboard change
    so it is posted right away and on startup. The text keeps markdown and **cannot ping**
    (`allowedMentions: parse []`). Only the GuildMessages intent, other people's text is never read.
    `POST /internal/sticky/clear` takes the copy down before the dashboard removes the row (the row
    stays if the bot can't be reached, so nothing is left behind). Runs only in production or with
    `BOT_INTEGRATIONS_IN_DEV`. Dashboard `/sticky` (admins).
- [~] Auto-publish (same branch): messages in the chosen **announcement** channels are crossposted
      (`modules/autopublish/`, needs Manage Messages there; Discord allows 10 per hour per channel, a
      refusal is logged). `GuildChannel.announcement` tells the dashboard which channels qualify.
      Dashboard `/auto-publish` (admins).
- [~] Custom commands (2026-10-24, `feature_custom-commands`, migration
      `20261024100000_custom_commands`; **not tried live yet**; Tier B/C)
  - Bot (`modules/customcommands/`): staff-written answers shown with `/tag name` (autocomplete from a
    60 s name cache, dropped on dashboard changes) and `/tags`. Names `[a-z0-9][a-z0-9_-]{0,31}`
    (DB CHECK), up to 100, answer up to 1800 chars with `{user}` `{username}` `{server}`; markdown
    kept, `allowedMentions` limited to the member who asked, optional private (ephemeral) answer, use
    counter. `Command` gained an optional `autocomplete` handler (dispatched in `interaction-create`).
    Dashboard `/custom-commands` (admins). **Auto-responders** (reacting to words in messages) are not
    built: they need the privileged Message Content intent.
- [~] Utility commands (2026-10-24, `feature_utility-commands`, no migration; **not tried live yet**; Tier C)
  - `modules/utility/`: `/userinfo`, `/serverinfo`, `/roleinfo`, `/avatar` (read-only embeds for every
    member, names escaped, nothing pings) and `commands/help.ts`: `/help` lists only the commands the
    asker may use (members, then the team; admin commands are hidden from moderators), built from the
    registered command list at call time. No dashboard page (nothing to configure). `/afk` is not built:
    it needs to read messages.
- [~] Counting channel (2026-10-25, `feature_counting-autoresponders`, migration
      `20261025100000_counting_autoresponders`; **not tried live yet**; Tier B)
  - Bot (`modules/counting/`): a message starting with a whole number in the chosen channel is judged
    against the stored count, read fresh and one message at a time. The next number from someone else
    gets a check mark (a trophy for a new high score) and is stored with **one conditional UPDATE**
    (`acceptNumber`, raw SQL so the high score moves in the same statement the CHECK needs); a wrong
    number or the same member twice (unless allowed) gets a cross, and a wrong number ends the streak
    if configured. Other messages are ignored. Needs Message Content, Add Reactions and Send Messages.
    Dashboard `/counting` (admins): settings, current number, high score, start over.
- [~] Auto-responders (same branch): answers a message that contains a trigger (whole word, contains or
      exact; compared as NFKC lower case; the trigger is only ever literal text, regex-escaped). The
      answer is a reply that pings nobody, with a per-responder cooldown per channel and at most one
      automatic answer per channel every 5 s. Up to 50, optional channel limit. Dashboard
      `/auto-responders` (admins). Both modules start only with `DISCORD_MESSAGE_CONTENT=true` and in
      production or with `BOT_INTEGRATIONS_IN_DEV`.
- [~] Modules page (2026-10-25, `feature_modules-page`, migration `20261025180000_module_flags`; **not tried
      live yet**; Tier C)
  - `ModuleFlag` rows (no row = on) switched on `/modules` (admins; saves at once). 19 features
    (`@aboutselphy/shared/modules`: welcome, role panels, levels, birthdays, starboard, counting, giveaways,
    polls, suggestions, tickets, logs, sticky, auto-publish, stat channels, custom commands, auto-responders,
    reminders, info commands, temp voice). Enforced in the bot by `lib/modules.ts` `moduleOn(key)` (60 s cache
    + reload; on a database error the last known state is kept, never "off"): `interaction-create` refuses
    the feature's slash commands and autocomplete, `dispatchComponent` its buttons/menus/modals, and the
    passive handlers (counting, auto-responders, sticky, auto-publish, starboard, XP, welcome, logs, role
    reactions) and jobs (reminders, birthdays, stat channels) do nothing while it is off. Settings and data
    stay; reminders stay queued. **Not switchable**: moderation, `/help`, `/ping`, Twitch, YouTube and
    announcements (own switches). Polls/giveaways already running still end on time.
- [~] Birthdays (2026-10-20, `feature_birthdays`, migration `20261020180000_birthdays`
      applied; **not tried live yet**; Tier B)
  - Bot (`modules/birthdays/`): `/birthday set|remove|show|upcoming` (open to every member;
    **day and month only, never the year**; `isValidDay` allows 29 Feb, celebrated on 28 Feb in
    common years). A round every 10 min (and on settings change; only in production or with
    `BOT_INTEGRATIONS_IN_DEV`) greets today's members in the configured IANA time zone, once per
    day (`claimDay` = one conditional UPDATE on `lastCelebratedOn`, so restarts never greet
    twice), optionally gives a role for the day (`checkRole` first) and takes it off everyone else.
    The greeting template has `{user}` (mention, the only ping) and `{name}`; the rest is escaped.
    A member who leaves is deleted (GDPR).
  - Dashboard `/birthdays` (admins): settings and the next 50 birthdays.
  - **Birthday card** (2026-10-23, `feature_member-cards`, migration `20261023100000_member_cards`):
    optional picture attached to the greeting (avatar, name, heading, `{date}` line) on the admin's
    own image, drawn by the welcome card renderer (`membercards` module wraps `renderWelcomeCard`).
    Settings on the same form; the image lives in `MemberCardImage` (one row per kind, same header
    checks as the welcome image: PNG/JPEG/WebP, <= 3 MB, 64-4096 px). Drawing failures send the
    greeting without the card.
  - [ ] Announce milestones with the year, staff-set birthdays, a monthly summary post.
- [~] Reminders (2026-10-21, `feature_reminders`, migration `20261021100000_reminders`
      applied; **not tried live yet**; Tier B)
  - Bot (`modules/reminders/`): `/remind me in:<30m|2h|3d> about:<text>` (1 min to 1 year,
    `parseDuration`), `/remind list`, `/remind cancel number:`; open to every member, a limit of
    pending reminders per member (config, default 10). A round every 30 s (only in production or
    with `BOT_INTEGRATIONS_IN_DEV`) claims each due reminder with one conditional UPDATE
    (delivered once), sends a DM, or posts in the channel where it was set if the DMs are closed;
    the text is escaped, only the owner is pinged; overdue ones after downtime say so. Delivered
    rows are pruned after a day; a member who leaves loses their reminders (GDPR).
  - Dashboard `/reminders` (admins): on/off, the per-member limit, and counts only (the text
    of members' reminders is never shown).
  - **Reminder card** (same branch): optional picture with the avatar, name and the reminder text under
    the name, attached to the DM or the channel message (`MemberCardImage` kind `reminder`).
  - **Channel limit and delivery choice** (2026-10-28, `feature_reminder-channel`, migration
    `20261028180000_reminder_channel`; **not tried live yet**): `ReminderConfig.channelId` restricts all of `/remind`
    (me, list, cancel) to one channel (empty = anywhere; elsewhere the member gets a private note naming the
    channel; picked on `/reminders`, validated through the bot). `/remind me where:` lets the member choose a DM
    (default) or the channel (`Reminder.delivery`, CHECK dm|channel); the chosen way is tried first and the other
    is the fallback (closed DMs, deleted channel), so nothing is lost.
  - [ ] Repeating reminders, `/remind` for a channel or another member, snooze button.
- [~] Role manager (2026-10-21, `feature_role-manager`, no migration; **not tried live yet**;
      asked for by the user)
  - Dashboard `/role-manager` (admins only): every role but @everyone with member count, colour,
    a "powerful permissions" badge and badges for where the bot still uses it (role panels, level
    rewards, auto-roles, no-XP, ticket staff, giveaways, announcements, Twitch/YouTube pings,
    birthday role). Search, filters (no members, not used by the bot, deletable, protected),
    multi-select, and **mass delete** behind a dialog that lists the roles and needs `DELETE` typed.
    Done in batches of 50 (`MAX_ROLE_DELETES`).
  - Bot: `GET /internal/roles/manage` (fills the member cache first, so counts are right) and
    `POST /internal/roles/delete`. **The bot decides again for every id** (`protectionOf`, pure,
    tested): integration-managed roles, roles at or above the bot's top role and the staff roles
    from `DISCORD_ADMIN_ROLE_IDS`/`DISCORD_MODERATOR_ROLE_IDS` are refused; each delete carries the
    admin's name as the audit-log reason and is logged. Deleting is irreversible and the settings
    pointing at a deleted role are not cleaned up (they are flagged in the dialog instead).
  - **Edit, merge and clean up** (2026-10-21, `feature_role-manager-tools`, no migration; **not
    tried live yet**): a pencil on each role renames and recolours it (`POST /internal/roles/update`,
    same protections as deleting). **Merge** (`POST /internal/roles/merge`): everyone holding any of
    up to 10 source roles gets the target, optionally deleting the sources afterwards, but only if
    nobody was missed. `checkMerge` (pure, tested) refuses a target that is staff, managed, above the
    bot, @everyone or has powerful permissions, so a merge can never hand out power. **Clean up**:
    the page lists settings that still point at roles that no longer exist (recomputed from the bot's
    current role list, never from the client) and removes those entries; tickets left without staff
    roles and birthdays left without channel or role are switched off, and the affected bot modules
    reload. Already posted role panels must be posted again. Long calls use their own timeout in
    `botFetch` (`timeoutMs`).
  - [ ] Reorder roles, copy permissions between roles.
- [~] Stat channels (2026-10-22, `feature_stat-channels`, migration `20261022100000_stat_channels`
      applied; **not tried live yet**; Tier B)
  - Bot (`modules/statchannels/`): up to 10 voice channels whose name shows a live number
    (`Members: {count}`): all members, people, bots, boosts, channels, roles, people in voice. A
    round every 10 min (Discord allows 2 renames per channel per 10 min) and when the dashboard
    changes the list; a channel is only renamed when its name differs. `renderStatName` (shared,
    tested) strips control/invisible characters and caps at 100. Needs Manage Channels on the
    channel; a deleted channel is forgotten. No "online" kind: that needs the privileged Presence
    intent. Only runs in production or with `BOT_INTEGRATIONS_IN_DEV`.
  - Dashboard `/stat-channels` (admins): add/edit/remove. Lock the channel for everyone (deny Connect)
    yourself in Discord.
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
- [~] Roles (2026-10-14, `feature_roles`, migration `20261014100000_role_panels`
      applied; **not tried live yet**; part of the replacement roadmap, Tier A)
  - **Create roles from the dashboard** (`/roles`, admins): the bot makes a cosmetic
    role (`POST /internal/roles/create`: name, colour, hoist, mentionable, **never any
    permission**); also available inside the panel dialog. Needs the bot's Manage Roles.
  - **Role panels** (`modules/roles/`): a message with buttons (<= 25, five per row) or a
    menu; "choose one" mode. Ids `rp:<panelId>[:<roleId>]`, parsed strictly. Safety
    (`safety.ts`, pure, tested): a role is only handed out if it is not @everyone, not
    managed, below the bot, and without Administrator/Manage*/Kick/Ban/Timeout/Mention
    Everyone/View Audit Log/voice moderation. Checked when the dashboard lists roles
    (`GuildRole.assignable`), on save, on posting, and **on every click** (a role that
    gained power later is refused). A click must be on the panel's own current message.
    `planToggle` (pure, tested) decides add/remove. Posted panels are edited on save and
    deleted from Discord on removal.
  - **Server emotes and reactions** (2026-10-14, `feature_role-emotes`, migration
    `20261014180000_role_panel_emotes` applied): a role's emoji can be unicode or one of
    the server's emotes stored as `<:name:id>` / `<a:name:id>` (`parseEmoji` in
    `@aboutselphy/shared/role-panel`; checked to exist in the server on save and on posting;
    a server emote matches a reaction by **id**, its name may change). Panel style
    `reactions`: the bot adds one reaction per role (max 20, each with its own emoji) and a
    legend in the message; reacting gives the role, removing the reaction takes it back,
    "choose one" keeps a single reaction, foreign emoji are removed again. Uses the
    `GuildMessageReactions` intent (not privileged) and partials (Message, Channel,
    Reaction, User). The dashboard form has a "Server emotes" picker (images from Discord's
    CDN, allowed by the CSP) next to the unicode text field.
  - **Panel picture** (2026-10-14, `feature_panel-image`, migration
    `20261014210000_role_panel_image`): `RolePanel.imageUrl`, https only (shared
    `isAllowedImageUrl`, a DB CHECK, and re-checked by the bot), shown big under the text
    like the example the user sent; the dashboard form has a full-message preview and
    never loads the picture. Role mentions typed into a panel's text (`<@&id>`) render
    as mentions without pinging (the message allows none).
  - **Emoji picker** (`emoji-picker.tsx`, branch `feature_emoji-picker`): search over the
    server's emotes and the standard emoji, categories as tabs. The standard list is the
    data-only package `unicode-emoji-json` (pinned 0.9.0), loaded with a dynamic import the
    first time a picker opens.
  - [ ] Auto-roles on join, welcome/goodbye messages, roles re-applied on rejoin: these
        need the **GuildMembers** privileged intent. Add it behind a flag, the bot refuses
        to log in if the intent isn't enabled in the Developer Portal.
- [~] Welcome (2026-10-15, `feature_welcome`, migration `20261015100000_welcome`
      applied; the bot logs in with the privileged **GuildMembers** intent (user enabled it);
      **joins and leaves not tried live yet**)
  - Bot (`modules/welcome/`): on join: auto-roles (one list for members, one for bots, max 5
    each), restoring a returning member's roles (optional; snapshot kept **90 days** in
    `MemberRoleSnapshot`, pruned daily, personal data), welcome message (plain or as a box with
    colour and https picture; the new member is mentioned so they are pinged, nobody else can
    be), optional DM. On leave: snapshot + goodbye line (no mentions). **Every role is
    checked with `checkRole` at the moment it is given**, so a restored role can never bring
    back power. Needs the bot's Manage Roles and its role above the offered roles. Only runs
    in production or with `BOT_INTEGRATIONS_IN_DEV` (two processes on one token would greet
    twice). Pure parts (`message.ts`, shared `welcome.ts`) are tested.
  - Dashboard `/welcome` (admins): one form with the role pickers, message editors with insert
    buttons and a preview, DM, goodbye. Roles and channels are validated through the bot.
  - **Variants and the welcome card** (2026-10-15, `feature_welcome-cards`, migration
    `20261015180000_welcome_cards` applied; the saved text was copied into the new list before
    the old column was dropped, rehearsed in a rolled-back transaction first):
    `WelcomeConfig.welcomeTemplates` holds up to 10 texts, `pickTemplate` (pure, tested) picks
    one at random, never the same twice in a row. Optional **card**: `card.ts` draws, with
    `@napi-rs/canvas` (prebuilt, pinned) and the bundled Plus Jakarta Sans (so no system
    fonts are needed), a 1024x360 PNG with the member's avatar, name, heading and a line like
    "Member #1234" on the admin's image, as the darkened **background** or as a **sticker** on
    a plain background; attached to the welcome message (and shown in its box). The image is
    stored in `WelcomeCardImage` (bytea, singleton): uploaded through an admin-only Server
    Action (body limit raised to 4 MB in `next.config.ts`), accepted only after
    `cardImageProblem` (`@aboutselphy/shared/image-info`) read its own header: real PNG/JPEG/
    WebP, <= 3 MB, 64-4096 px a side (the bot checks again before decoding). The avatar is
    only fetched from `cdn.discordapp.com`/`media.discordapp.net`, <= 1 MB, header-checked.
    If drawing fails the welcome goes out without the card. Dashboard preview: the bot draws
    a sample from the **saved** settings (`POST /internal/welcome/preview`), shown through the
    admin-only routes `/api/welcome/card-preview` and `/api/welcome/card-image`.
    Known limits: names in scripts the bundled font lacks (CJK, emoji) show as boxes on the
    card (the Docker image has no system fonts); the bot image has **not** been built with
    the canvas dependency yet (Docker is off): check `@napi-rs/canvas` on alpine/musl when it
    is next built.
  - [ ] Join/leave **logs** (separate channel, account age), invite tracking, member
        screening/verification gate, raid protection.
- [x] Phase 6 — new video upload (2026-10-13, `feature_youtube`, migration
      `20261013180000_youtube` applied; the first poll against the real API ran and
      only remembered the current 10 videos; **no real announcement seen yet**)
  - Bot (`modules/youtube/`): polls the uploads playlist (`UU` + id) every 5 min and
    on settings change (2 quota units per round, never `search.list`); `logic.ts`
    (pure, tested): first run remembers silently, private/live/upcoming videos wait,
    Shorts (<= 180 s) skipped unless on, nothing older than 48 h is announced as new;
    unique video id = announced once; the API key goes in an `x-goog-api-key` header;
    errors are short codes (`quota`, `keyRejected`, `notFound`, `failed`) stored in
    `YoutubeConfig.lastError`. Needs `YOUTUBE_API_KEY` (plain key, **not** the
    `GOOGLE_CLIENT_*` OAuth pair) and `YOUTUBE_CHANNEL_ID` (UC..., not the handle).
  - Dashboard `/youtube` (admins): poller status, settings with preview, latest
    videos and whether they were announced.
  - [ ] Several channels, members-only/premieres, a "watch" button
- [~] Feed announcer (2026-10-27, `feature_feeds`, migration `20261027100000_feeds`; **not tried with a real
      feed yet**; asked for by the user: TikTok upload notifications through RSSHub)
  - Bot (`modules/feeds/`): `FeedSource` rows (name, address, channel, optional ping role, message template
    `{name} {title} {link}`, interval 5-1440 min) and `FeedItem` (seen guids, unique per feed). A round every
    minute checks due feeds; `getText` (`lib/safe-http.ts`) fetches with a 10 s timeout and a 1 MB cap, no
    redirects, and the same connect-time address check as the webhooks: only **public https** hosts, plus
    the exact hosts in `RSS_INTERNAL_HOSTS` (the name of an RSSHub service on the private network; http
    allowed there). `parse.ts` reads RSS 2.0 and Atom with `fast-xml-parser` 5.11.2 (pinned; items capped at
    50, fields cut, hostile input tested). **A feed's first successful check only remembers what is there**,
    afterwards new items are announced oldest first, only if younger than 48 h, **at most 5 per check**
    (the rest are remembered silently), and each is remembered *before* it is posted, so no restart or
    second check announces it twice. The title is escaped, the link only shown if http(s), only the
    configured role can ping. The address is stored AES-256-GCM encrypted (`feed-url`; bridges carry an
    access key in it) and the dashboard only shows its host; a new address starts over silently. Needs
    `TOKEN_ENCRYPTION_KEY`. Runs only in production or with `BOT_INTEGRATIONS_IN_DEV`; switchable on
    `/modules`. `POST /internal/feeds/check` is the dashboard's "Check now".
  - Dashboard `/feeds` (admins): add/edit (address write-only), check now, remove, last status per feed.
  - **RSSHub** is a separate Dokploy service (template "RSSHub"), not part of this repo: deploy it in the same
    project/network, set its `ACCESS_KEY`, and use a feed address like
    `http://<service name>:1200/tiktok/user/@name?key=<ACCESS_KEY>` with that service name in
    `RSS_INTERNAL_HOSTS`. TikTok blocks many datacenter addresses, so that route can be flaky: the status
    on the page tells. Other projects can use the same RSSHub.
  - [ ] A "watch" embed instead of a plain link, per-feed filters (keywords), several items in one message.
- [~] Phase 7 — webhooks (2026-10-26, `feature_webhooks`, migration `20261026100000_webhooks`; the public
      endpoint was tested end to end against a temporary row, **not tried with a real sender yet**)
  - **Incoming** (`/webhooks` admin page, public route `POST /api/webhooks/in/<id>`, outside the sign-in gate):
    `WebhookEndpoint` rows (name, channel, secret). Request = `X-Webhook-Timestamp` (unix s, +-5 min) +
    `X-Webhook-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>">`; `@aboutselphy/shared/
    webhook-signature` (Node only) signs and verifies (constant-time compare). Order in `receive.ts`: id
    format, size (8 KB, read with a hard 16 KB cap), per-IP limit (120/min), timestamp, lookup, decrypt,
    **signature over the raw body**, replay cache (signature seen in the last 10 min = 401), per-endpoint
    limit (30/min), strict JSON (`title`, `content`, https `url`, `color`; unknown fields refused), then the
    bot posts an embed (`POST /internal/webhooks/relay`: escaped, no pings, link only if https). Every
    authentication failure is the same plain 401; only 400/413/429/502/503 differ. Secrets are 32 random
    bytes, stored AES-256-GCM encrypted (purpose `webhook-endpoint-secret`), **shown once** when made or
    rotated, never returned again. The rate and replay caches are in memory (one dashboard process).
    **Cloudflare**: add a path-scoped WAF rule skipping Bot Fight Mode for `/api/webhooks/in/*` before using
    it from a service, or the sender gets a challenge page.
  - **Outgoing**: `OutboundWebhook` (a Discord webhook address, or any https address with a signed JSON
    body `{id,event,timestamp,data}` and the same two headers). Events: `mod.case` (every case, from
    `postCaseLog`) and `twitch.live`. The address is stored encrypted (`webhook-outbound-url`); the page
    shows only the host. `lib/safe-http.ts` connects only after checking the address the name resolves to
    **at connect time** (blocks loopback, private, link-local/metadata, CGNAT, multicast, reserved, IPv6
    and IPv4-mapped forms; tested), no redirects, answer body never read, one attempt, 5 s timeout, the
    result (`ok`, `http 500`, `blocked`...) is remembered. "Send a test" calls `POST /internal/webhooks/test`.
    Sending only runs in production or with `BOT_INTEGRATIONS_IN_DEV`. Both directions need
    `TOKEN_ENCRYPTION_KEY`.
  - [ ] Provider presets (GitHub, Ko-fi, Stripe-style signatures), more events (member joined, level up),
        retries with backoff, disabling a webhook after repeated failures.
