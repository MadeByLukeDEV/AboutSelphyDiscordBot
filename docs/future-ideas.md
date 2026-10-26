# Future ideas

Things that are **not built** and not needed right now (decided 2026-10-26). Nothing here is planned; pick one up when the community or the need is there. Details of what exists live in [CLAUDE.md](../CLAUDE.md).

## Skipped on purpose
- **Anti-bot pattern engine** (regex through `re2`, rules, hit counters, dry run) and **basic automod** (blocked words, invite links, mass mentions, caps, repeats). Only the trap channel exists. Ask before starting: the two overlap.
- **Kick / TikTok live alerts** and **members-only YouTube videos**: no usable public API.

## Small features
- **Voice**: voice-text chat cleanup (clear the room's chat when the room is deleted).
- **Minigames**: emoji quiz, trivia questions and word lists editable in the dashboard, a scheduled daily trivia post.
- **Announcements**: several embeds or fields in one announcement.
- **Invites**: rewards or a role for the top inviters.
- **Screening**: questions asked of the new member before the staff card; a retention job for decided entries.
- **Reminders**: `/remind` for a channel or for another member.
- **Webhooks**: more incoming providers (Patreon, Twitch Extensions, ...).
- **Leveling**: import XP from other bots' formats (only MEE6's leaderboard JSON and plain `id xp name` lines work now).
- **Members**: nothing open.

## Events (the game calendar)
The module exists and works (stored events, page fetching, AI extraction, rules, cards, patch notes, widget) but is **not in use**: too many games, every site works differently. Ideas if it comes back:
- A reminder at the start time, one rule posting to several channels, other calendar formats.
- Per game a small hand-written parser instead of AI where a site is stable.
- If it stays unused: remove the module and its tables in one cleanup (a destructive migration, run only with a deploy).

## Operations
- Build and run the Docker images end to end from a fresh clone.
- Moderator-role (non-admin) login check; audit-log capture check in Discord.
- Have the Terms and Privacy wording checked by a lawyer / data protection officer; an Impressum may be needed.
- A Cloudflare WAF rule skipping Bot Fight Mode for `/api/webhooks/in/*` before a real sender uses incoming webhooks.
