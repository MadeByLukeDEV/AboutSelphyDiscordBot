# AboutSelphy Discord Bot + Dashboard

A custom Discord bot for the AboutSelphy community server, together with a staff dashboard to configure it.
One bot, one config, one data store: it replaces **Dyno, Carl-bot, MEE6, Streamcord, Voicetemp and VoiceMaster**.

- **Bot** (`apps/bot`): a persistent gateway connection built on discord.js 14, slash commands, background jobs and a small internal API.
- **Dashboard** (`apps/dashboard`): a Next.js app where staff manage every feature. Sign-in goes through the central AboutSelphy auth service; moderators see moderation tools, admins see everything.
- **Single server by design.** The bot serves one guild and ignores or leaves any other.

> Detailed, per-feature documentation (behaviour, data model, lessons learned) lives in [CLAUDE.md](CLAUDE.md).

---

## What it can do

### Moderation and logs
- `/warn /timeout /untimeout /kick /ban /unban /note /case /infractions`, numbered cases, mod-log channel, DMs to the member.
- Hierarchy and permission checks on every action; temporary bans that survive restarts; warning escalation (N warnings lead to a timeout, kick or ban).
- Actions done in Discord's own UI are captured through the audit log and become cases too.
- Channel tools: `/purge`, `/slowmode`, `/lock`, `/unlock`.
- Server logs: joins and leaves, nickname and role changes, voice activity, channel and role changes, message edits and deletes. Each kind has its own channel and switch.
- Dashboard: case list and search, member pages with history and a warn/timeout/ban form, reason editing, CSV export, per-moderator stats.
- Entry protection: verification button gate, raid protection, a screening queue with staff approval, a trap channel that catches spam bots, invite tracking.

### Members and roles
- Welcome and goodbye messages (random variants, optional image card), auto-roles for members and bots, roles restored when someone rejoins.
- Role panels with buttons, select menus or reactions; server emotes supported.
- Role manager in the dashboard: edit, reorder, merge, bulk-delete and clean up roles safely.

### Community
- **Leveling**: XP for messages and voice time, MEE6-style curve, role rewards, XP boosts, periodic resets, `/rank` cards, `/leaderboard` and an optional public leaderboard page.
- **Tickets**: panel button, private channels, ticket types, claim, transcripts, ratings, auto-close.
- **Giveaways**, **polls** (with results chart), **suggestions** with staff decisions, **starboard**, **birthdays**, **reminders** (snooze and repeat), **counting channel**, **sticky messages**, **stat counter channels**, **custom commands** (`/tag`), **auto-responders**, **auto-publish** for announcement channels.
- **Minigames** (`/game`): trivia, rock paper scissors, tic-tac-toe, connect four, hangman, word scramble, guess the number, coin flip, dice, 8-ball. Wins give level XP (capped per day).

### Voice
- **Temporary voice channels**: join-to-create lobbies with their own category, name and limits. Owners control their room from a panel or `/voice` (name, limit, lock, allow-list, kick, block, transfer). Room settings can be remembered, per-role limits and bitrate, AFK mover, banned-name list.

### Streams, feeds and content
- **Twitch**: instant "went live" posts via EventSub, live role, VIP role linking, clip posts, up to 100 channels.
- **YouTube** upload and premiere announcements.
- **RSS/Atom feed announcer** (for example TikTok through RSSHub) with keyword filters and digests.
- **Event calendar** per game (drops, events, updates, sales): fetched from calendars and pages, optional AI extraction, reminders, overview and monthly summary posts, item pictures, patch notes, a public widget and JSON endpoint.
- **Announcements**: composer with embed preview, scheduling, recurring posts, templates, role ping.
- **Webhooks**: incoming (generic signed, GitHub, Ko-fi, Stripe) and outgoing (Discord or signed HTTPS) for bot events.

### Privacy and operations
- `/mydata export | delete | hide | show` for members, retention limits, erase-on-request, a dashboard audit trail.
- A Modules page to switch features on and off, German and English dashboard, public Terms and Privacy pages.

## Member commands

`/afk` `/avatar` `/birthday` `/game` `/help` `/ideas` `/invites` `/leaderboard` `/mydata` `/rank` `/remind` `/roleinfo` `/serverinfo` `/starboard` `/suggest` `/tag` `/tags` `/userinfo` `/vip` `/voice`

Staff commands (moderators and admins) cover moderation, giveaways, polls, embeds, raid mode, Twitch, temp voice and XP. `/help` shows each person only what they may use.

## Public pages

| Page | What |
| --- | --- |
| `/features` | What the bot offers members (also posted as embeds into Discord from the dashboard) |
| `/leaderboard` | Optional public XP leaderboard |
| `/widget/<id>` and `/api/events/public/<id>` | Event widget for OBS or embedding, and its JSON |
| `/terms`, `/privacy` | Terms of Service and Privacy Policy |

---

## Architecture

A pnpm workspace monorepo, TypeScript, Node 22.

```
apps/
  bot/         discord.js bot: commands/, events/, modules/<feature>/, internal-api/, lib/
  dashboard/   Next.js 16 staff dashboard: app/, modules/<feature>/, components/
packages/
  db/          PostgreSQL + Prisma 7 schema (own schema "bot") and migrations
  shared/      zod schemas and constants used by both apps
```

- Each feature is a module with a service, a private repository, schemas and its own commands or events. Modules only import each other through their public entry points.
- The dashboard writes config to Postgres and tells the bot through an authenticated internal API; the bot is the only thing that talks to Discord. Bot-side config is cached with a 60 s fallback TTL.
- Restart-safe by design: jobs claim work with a single conditional database update, first runs seed a silent baseline instead of announcing, and state is reconciled on startup.
- Every user-controlled string is escaped before it reaches an embed, and mentions are always explicit.

Stack: discord.js 14, Next.js 16 (App Router), React 19, Tailwind v4, shadcn (Base UI), next-intl, react-hook-form + zod, Prisma 7 with `@prisma/adapter-pg`, pino, Vitest.

## Local development

```bash
pnpm install
pnpm dev:bot          # the bot (use a dev token and a test server)
pnpm dev:dashboard    # the dashboard on http://localhost:3004
pnpm typecheck
pnpm lint
pnpm test
```

Copy `.env.example` files for the required variables. Sign-in needs the central auth service running.

## Docs

- [CLAUDE.md](CLAUDE.md): full project documentation, feature by feature, with design decisions and lessons.
- In the dashboard: the public `/features` page and the in-app help text on each page.
