// Same role names as the central auth service (../Auth/src/lib/roles.ts).
export const STAFF_ROLES = ["admin", "moderator"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isAdmin(role: string | null | undefined): role is "admin" {
  return role === "admin";
}

export function canAccessDashboard(role: string | null | undefined): role is StaffRole {
  return role === "admin" || role === "moderator";
}
