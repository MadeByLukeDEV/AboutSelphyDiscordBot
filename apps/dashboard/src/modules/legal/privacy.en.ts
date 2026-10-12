import type { LegalDoc, Operator } from "./types";

export function privacyEn(o: Operator): LegalDoc {
  return {
    title: "Privacy Policy",
    intro:
      "This policy explains which personal data the AboutSelphy bot and its staff dashboard process, why, for how long, and what you can do about it. It is written for the people in the AboutSelphy Discord server. The bot only works in that one server.",
    sections: [
      {
        id: "controller",
        heading: "1. Who is responsible",
        blocks: [
          "The person responsible for the processing described here (the controller) is:",
          { list: [o.name, o.address, `Email: ${o.email}`, `Country: ${o.country}`] },
          "Discord Inc. runs the Discord platform and is a separate controller for what it does with your account. Please read Discord's own privacy policy as well. This policy only covers what the bot and the dashboard do on top of Discord.",
        ],
      },
      {
        id: "what",
        heading: "2. What the bot processes and why",
        blocks: [
          "The bot receives the information Discord gives every bot in a server: your user ID, username and server nickname, avatar address, roles, the date you joined, and events such as messages, reactions, voice channel joins and leaves. It uses this to run its features. What is stored beyond that depends on the feature:",
          {
            list: [
              "Moderation (warnings, timeouts, kicks, bans, notes, cases): your user ID and name at that time, the moderator, the reason, the time and, for timed actions, the duration. Actions done directly in Discord by a moderator are recorded too. Purpose: keeping the community safe and fair.",
              "Server logs (joins and leaves with account age, nickname and role changes, voice channel joins, leaves and moves, changes to channels and roles, edited and deleted messages): these are posted into private staff channels in Discord, not stored in the bot's own database. For edited and deleted messages the text is shown only if the bot still had it in memory.",
              "Levels: your user ID, display name, experience points and counters (number of messages and voice minutes). The content of your messages is not read for this. Purpose: the rank, leaderboard and role rewards.",
              "Tickets: who opened the ticket, who handled it, and the messages written in the private ticket channel. When a ticket is closed a transcript (up to 2,000 messages) is saved so staff can look at it later. Purpose: support and dispute handling.",
              "Birthdays (optional): the day and month you choose, never the year, plus your name. Only if you use /birthday set.",
              "Reminders (optional): the text and time you enter with /remind. Only if you use /remind.",
              "Twitch VIP link (optional): your Discord ID and name, and the Twitch account name you claim with /vip link. If you use the \"Link with Discord\" button, Discord shows us the Twitch account connected to your profile once (we ask only for your identity and connections, keep just the Twitch account ID and name, and discard the access token straight away); if you type a name instead, staff confirm it before a role is given. Only if you use /vip link.",
              "Suggestions, polls and giveaways: your suggestion text and name, your votes and entries. They are stored with your user ID so nobody can vote or enter twice. Votes in polls are shown to others only as counts.",
              "Starboard: when a message gets enough reactions it is reposted in a showcase channel with its text, name, picture and a link to the original.",
              "Welcome: the roles given to you when you join. If enabled, the roles you had when you left are remembered so they can be restored if you come back.",
              "Counting channel: the numbers sent there and who counted last.",
              "Temporary voice rooms: who owns a room and the room's settings. The settings live in the Discord channel itself.",
              "Messages are read live (not stored) for features that react to text: auto-responders, the counting channel, sticky messages and message logs. The bot needs Discord's \"Message Content\" permission for this.",
              "Feeds, Twitch and YouTube announcements use public information about the operator's own channels. They do not process data about members.",
              "Webhooks: messages sent to the bot's incoming webhook addresses by other services are posted as Discord messages. The bot does not keep them beyond that Discord message.",
            ],
          },
        ],
      },
      {
        id: "dashboard",
        heading: "3. The staff dashboard",
        blocks: [
          "The dashboard is only for staff of the server. Staff sign in through a separate central sign-in service (auth.aboutselphy.com), which handles the account, the session and its cookie under its own rules. The dashboard checks the staff role and stores, for some actions, the name of the staff member who did them (for example who created a poll or deleted a role).",
          "The dashboard uses only technically necessary storage: the sign-in cookie of the central service, a language cookie and a remembered colour theme. It has no analytics, no advertising and no tracking.",
        ],
      },
      {
        id: "basis",
        heading: "4. Legal bases",
        blocks: [
          {
            list: [
              "Running a safe and well-moderated community, preventing abuse and keeping the bot secure: legitimate interests, Art. 6(1)(f) GDPR.",
              "Features you ask for yourself (birthday, reminders, rank, suggestions, tickets, giveaway entries, votes): providing what you asked for, Art. 6(1)(b) GDPR, and for the optional birthday and reminder data your choice to use the command, Art. 6(1)(a) GDPR. You can withdraw at any time (see section 8).",
              "If you disagree with a processing based on legitimate interests, you can object (section 8).",
            ],
          },
        ],
      },
      {
        id: "recipients",
        heading: "5. Who receives data",
        blocks: [
          "Staff of the server see the data they need for their task (moderators see cases and tickets, administrators see settings). Nothing is sold, used for advertising or used to build profiles.",
          { list: [`Hosting: the bot, the dashboard and the database run on ${o.hosting}.`, "Discord Inc.: the platform on which the bot works. Everything the bot posts or reads goes through Discord.", "Cloudflare: delivers the dashboard's web address (traffic passes through it).", "Third-party sites such as Twitch, YouTube or TikTok are only read for public information about the operator's channels, and their links may be shown in the server."] },
        ],
      },
      {
        id: "transfers",
        heading: "6. Transfers outside the EU/EEA",
        blocks: ["Discord and Cloudflare are based in the USA. They transfer data under their own terms, which rely on the EU-US Data Privacy Framework and/or standard contractual clauses. The bot's own database stays on the hosting named above."],
      },
      {
        id: "retention",
        heading: "7. How long data is kept",
        blocks: [
          {
            list: [
              "Birthdays, reminders and your Twitch VIP link: deleted when you remove them (/birthday remove, /remind cancel, /vip unlink) or when you leave the server. Delivered reminders are deleted after one day.",
              "Remembered roles after leaving: 90 days.",
              "Moderation cases and notes: kept while they are needed to keep the community safe and to answer appeals; they are reviewed from time to time. You can ask for deletion (section 8).",
              "Ticket transcripts, suggestions, polls, giveaway entries, levels and starboard posts: kept while the feature is in use and until you ask for deletion or the operator removes them.",
              "Server logs in staff channels: kept as long as staff keep the messages in those Discord channels.",
              "Technical logs of the bot (user and channel IDs, errors) live on the server and are rotated by the hosting setup. They contain no message text.",
            ],
          },
        ],
      },
      {
        id: "rights",
        heading: "8. Your rights",
        blocks: [
          `You can ask the operator at ${o.email} (or a staff member in the server) for access to your data, correction, deletion, restriction, a copy in a common format, and you can object to processing based on legitimate interests or withdraw consent at any time. You will get an answer within one month.`,
          "You can also delete some data yourself: /birthday remove, /remind cancel, and by leaving the server (this removes your birthday and reminders). Deletion can be refused where the data is still needed to protect others or to defend a legal claim, for example an active ban record.",
          "You have the right to complain to a data protection authority, in particular in the country where you live or work.",
        ],
      },
      {
        id: "security",
        heading: "9. Security",
        blocks: ["Access to the dashboard is limited to staff roles and checked on every action. Connections use HTTPS. Secrets such as tokens and webhook addresses are stored encrypted. The bot only does what the dashboard's settings allow and does not give out dangerous permissions."],
      },
      {
        id: "children",
        heading: "10. Minimum age",
        blocks: ["Discord requires its users to be at least 13 years old, or older where local law says so. The bot is not meant for anyone below that age and does not knowingly process their data. If you think this happened, contact the operator."],
      },
      {
        id: "changes",
        heading: "11. Changes",
        blocks: ["This policy changes when features or the law change. The date at the top shows the current version. Important changes will be announced in the server."],
      },
      {
        id: "contact",
        heading: "12. Contact",
        blocks: [`${o.name}, ${o.email}`],
      },
    ],
  };
}
