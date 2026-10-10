import { LayoutDashboard, Mic, ScrollText, Settings, type LucideIcon } from "lucide-react";
import type { StaffRole } from "@/modules/auth/roles";

export type NavItem = {
  href: string;
  /** Key under Shell.nav in the message catalogs. */
  labelKey: "overview" | "cases" | "voiceRooms" | "settings";
  icon: LucideIcon;
  /** Omit for "all staff"; "admin" hides it from moderators (their actions would be rejected anyway). */
  requires?: Extract<StaffRole, "admin">;
};

// A module's page is added here together with the page itself.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "overview", icon: LayoutDashboard },
  { href: "/cases", labelKey: "cases", icon: ScrollText },
  { href: "/voice-rooms", labelKey: "voiceRooms", icon: Mic, requires: "admin" },
  { href: "/settings", labelKey: "settings", icon: Settings, requires: "admin" },
];
