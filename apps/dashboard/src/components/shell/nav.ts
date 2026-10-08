import { LayoutDashboard, type LucideIcon } from "lucide-react";
import type { StaffRole } from "@/modules/auth/roles";

export type NavItem = {
  href: string;
  /** Key under Shell.nav in the message catalogs. */
  labelKey: "overview";
  icon: LucideIcon;
  /** Omit for "all staff"; "admin" hides it from moderators (they'd be rejected anyway). */
  requires?: Extract<StaffRole, "admin">;
};

// A module's page is added here together with the page itself.
export const NAV_ITEMS: NavItem[] = [{ href: "/", labelKey: "overview", icon: LayoutDashboard }];
