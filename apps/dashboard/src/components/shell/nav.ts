import type { StaffRole } from "@/modules/auth/roles";

/** Keys under Shell.nav.items in the message catalogs. */
export type NavLabel = "overview" | "cases" | "settings" | "voiceRooms" | "twitch" | "youtube" | "announcements" | "roles" | "welcome" | "logs" | "levels" | "tickets" | "giveaways" | "suggestions" | "polls" | "starboard" | "birthdays" | "reminders" | "roleManager" | "statChannels" | "sticky" | "autoPublish" | "customCommands" | "counting" | "autoResponders" | "modules" | "webhooks" | "feeds" | "modGuide" | "antiBot" | "twitchVip" | "retention" | "memberLookup" | "verification" | "raid" | "audit" | "invites";
/** Keys under Shell.nav.groups; null = no heading. */
export type NavGroupLabel = "moderation" | "members" | "engagement" | "voice" | "content" | "streams" | "system";

type NavItemSpec = {
  href: string;
  label: NavLabel;
  /** Omit for "all staff"; "admin" hides it from moderators (their actions would be rejected anyway). */
  requires?: Extract<StaffRole, "admin">;
};

type NavGroupSpec = { label: NavGroupLabel | null; items: NavItemSpec[] };

// A module's page is added here together with the page itself. Groups are by what an admin is trying to do,
// so a feature is found where it is looked for: people and roles, community games, voice, content that
// gets posted, outside sources, and the bot's own system settings.
const NAV: NavGroupSpec[] = [
  { label: null, items: [{ href: "/", label: "overview" }] },
  {
    label: "moderation",
    items: [
      { href: "/cases", label: "cases" },
      { href: "/members", label: "memberLookup" },
      { href: "/invites", label: "invites" },
      { href: "/tickets", label: "tickets" },
      { href: "/logs", label: "logs", requires: "admin" },
      { href: "/mod-guide", label: "modGuide", requires: "admin" },
      { href: "/anti-bot", label: "antiBot", requires: "admin" },
    ],
  },
  {
    label: "members",
    items: [
      { href: "/welcome", label: "welcome", requires: "admin" },
      { href: "/verification", label: "verification", requires: "admin" },
      { href: "/raid", label: "raid", requires: "admin" },
      { href: "/roles", label: "roles", requires: "admin" },
      { href: "/role-manager", label: "roleManager", requires: "admin" },
      { href: "/levels", label: "levels", requires: "admin" },
      { href: "/birthdays", label: "birthdays", requires: "admin" },
    ],
  },
  {
    label: "engagement",
    items: [
      { href: "/giveaways", label: "giveaways" },
      { href: "/polls", label: "polls" },
      { href: "/suggestions", label: "suggestions" },
      { href: "/starboard", label: "starboard", requires: "admin" },
      { href: "/counting", label: "counting", requires: "admin" },
    ],
  },
  {
    label: "voice",
    items: [
      { href: "/voice-rooms", label: "voiceRooms", requires: "admin" },
      { href: "/stat-channels", label: "statChannels", requires: "admin" },
    ],
  },
  {
    label: "content",
    items: [
      { href: "/announcements", label: "announcements" },
      { href: "/sticky", label: "sticky", requires: "admin" },
      { href: "/auto-publish", label: "autoPublish", requires: "admin" },
      { href: "/custom-commands", label: "customCommands", requires: "admin" },
      { href: "/auto-responders", label: "autoResponders", requires: "admin" },
      { href: "/reminders", label: "reminders", requires: "admin" },
    ],
  },
  {
    label: "streams",
    items: [
      { href: "/twitch", label: "twitch", requires: "admin" },
      { href: "/twitch-vip", label: "twitchVip", requires: "admin" },
      { href: "/youtube", label: "youtube", requires: "admin" },
      { href: "/feeds", label: "feeds", requires: "admin" },
    ],
  },
  {
    label: "system",
    items: [
      { href: "/modules", label: "modules", requires: "admin" },
      { href: "/webhooks", label: "webhooks", requires: "admin" },
      { href: "/retention", label: "retention", requires: "admin" },
      { href: "/audit", label: "audit", requires: "admin" },
      { href: "/settings", label: "settings", requires: "admin" },
    ],
  },
];

/** What the (client) navigation components receive: plain data, no components, already filtered by role. */
export type NavGroup = { label: NavGroupLabel | null; items: Array<{ href: string; label: NavLabel }> };

/** Hiding an item is only a convenience: every page and Server Action re-checks the role itself. */
export function navFor(isAdmin: boolean): NavGroup[] {
  return NAV.map((group) => ({
    label: group.label,
    items: group.items.filter((i) => !i.requires || isAdmin).map(({ href, label }) => ({ href, label })),
  })).filter((group) => group.items.length > 0);
}
