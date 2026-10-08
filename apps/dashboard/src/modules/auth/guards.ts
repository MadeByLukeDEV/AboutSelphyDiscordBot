import "server-only";
import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { canAccessDashboard, isAdmin } from "./roles";
import { getStaffSession, loginUrl, type StaffSession } from "./session";

// Every page and every Server Action / route handler checks auth itself. The
// proxy is only the first gate: it skips next/link prefetches, and Server
// Actions are plain POST endpoints anyone can call.

export class AuthorizationError extends Error {
  constructor(message = "Not allowed") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For Server Actions and route handlers: the staff session, or throws. */
export async function requireStaff(): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session || !canAccessDashboard(session.user.role)) throw new AuthorizationError();
  return session;
}

/** For admin-only Server Actions and route handlers: the session, or throws. */
export async function requireAdmin(): Promise<StaffSession> {
  const session = await requireStaff();
  if (!isAdmin(session.user.role)) throw new AuthorizationError("Admins only");
  return session;
}

/**
 * For pages/layouts: the staff session, or a redirect to the central login
 * that returns to `returnPath` (a path on this site, e.g. "/").
 */
export async function requireStaffPage(returnPath = "/"): Promise<StaffSession> {
  const session = await getStaffSession();
  if (!session || !canAccessDashboard(session.user.role)) {
    redirect(loginUrl(`${siteUrl()}${returnPath}`));
  }
  return session;
}
