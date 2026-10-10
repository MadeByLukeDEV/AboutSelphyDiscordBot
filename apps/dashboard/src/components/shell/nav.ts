import type { StaffRole } from "@/modules/auth/roles";

/** Keys under Shell.nav.items in the message catalogs. */
export type NavLabel = "overview" | "cases" | "settings" | "voiceRooms" | "twitch" | "youtube" | "announcements" | "roles" | "welcome" | "logs" | "levels" | "tickets" | "giveaways" | "suggestions" | "polls" | "starboard" | "birthdays" | "reminders";
/** Keys under Shell.nav.groups; null = no heading. */
export type NavGroupLabel = "moderation" | "community";

type NavItemSpec = {
  href: string;
  label: NavLabel;
  /** Omit for "all staff"; "admin" hides it from moderators (their actions would be rejected anyway). */
  requires?: Extract<StaffRole, "admin">;
};

type NavGroupSpec = { label: NavGroupLabel | null; items: NavItemSpec[] };

// A module's page is added here together with the page itself.
const NAV: NavGroupSpec[] = [
  { label: null, items: [{ href: "/", label: "overview" }] },
  {
    label: "moderation",
    items: [
      { href: "/cases", label: "cases" },
      { href: "/tickets", label: "tickets" },
      { href: "/logs", label: "logs", requires: "admin" },
      { href: "/settings", label: "settings", requires: "admin" },
    ],
  },
  {
    label: "community",
    items: [
      { href: "/announcements", label: "announcements" },
      { href: "/giveaways", label: "giveaways" },
      { href: "/suggestions", label: "suggestions" },
      { href: "/polls", label: "polls" },
      { href: "/starboard", label: "starboard", requires: "admin" },
      { href: "/birthdays", label: "birthdays", requires: "admin" },
      { href: "/reminders", label: "reminders", requires: "admin" },
      { href: "/roles", label: "roles", requires: "admin" },
      { href: "/welcome", label: "welcome", requires: "admin" },
      { href: "/levels", label: "levels", requires: "admin" },
      { href: "/voice-rooms", label: "voiceRooms", requires: "admin" },
      { href: "/twitch", label: "twitch", requires: "admin" },
      { href: "/youtube", label: "youtube", requires: "admin" },
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
