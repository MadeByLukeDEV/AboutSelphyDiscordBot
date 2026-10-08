// Roles come from the central auth service (auth.aboutselphy.com), which
// derives them from the user's Discord server roles on every sign-in -- this
// app never assigns them. Every authorization check goes through these
// helpers (shared with the bot), never an inline role comparison.
//   - "admin": the owner. Everything, including bot/integration settings.
//   - "moderator": logs, cases, warnings, announcements.
export { canAccessDashboard, isAdmin, type StaffRole } from "@aboutselphy/shared";
