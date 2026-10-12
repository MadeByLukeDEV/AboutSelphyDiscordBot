import "server-only";
import { errorInfo } from "@/lib/log";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import { recordEntry } from "./repository";
import { auditTarget, wasSuccessful } from "./rules";

/**
 * Wraps a Server Action's body so that every action that worked leaves a line in the audit trail: who (the signed-in
 * staff member, read again from the session), which action, and, when the first argument is a short id, which thing.
 * Arguments are NOT stored: they can hold secrets (a webhook address, a token) or members' text. Recording is best
 * effort: a failure to write the line is logged and never changes the action's own result.
 */
export async function audited<A extends unknown[], R>(action: string, run: (...args: A) => Promise<R>, args: A): Promise<R> {
  const result = await run(...args);
  if (wasSuccessful(result)) {
    try {
      const session = await requireStaff();
      const [area, ...rest] = action.split(".");
      await recordEntry({ actorId: session.user.id, actorName: session.user.name, actorRole: session.user.role, area: area ?? "other", action: rest.join(".") || action, target: auditTarget(args[0]) });
    } catch (error) {
      if (!(error instanceof AuthorizationError)) console.error("[audit] could not record an action", errorInfo(error));
    }
  }
  return result;
}
