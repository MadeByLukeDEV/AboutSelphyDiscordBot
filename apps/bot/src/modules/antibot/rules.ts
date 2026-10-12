// Pure part of the anti-bot channel: who is caught when they write in it. Nobody who runs the server is.

export type Writer = {
  /** A bot account, a webhook or a Discord system message. */
  automated: boolean;
  /** The server owner. */
  owner: boolean;
  /** "admin" or "moderator" by the configured staff roles, otherwise null. */
  staff: "admin" | "moderator" | null;
  /** Holds Administrator or Manage Server in Discord itself. */
  powerful: boolean;
};

export type Verdict = { act: true } | { act: false; reason: "automated" | "owner" | "staff" | "powerful" };

/** Whether a message in the trap channel should be punished. Staff and the owner may write there (to explain it, to clean up). */
export function judge(w: Writer): Verdict {
  if (w.automated) return { act: false, reason: "automated" };
  if (w.owner) return { act: false, reason: "owner" };
  if (w.staff) return { act: false, reason: "staff" };
  if (w.powerful) return { act: false, reason: "powerful" };
  return { act: true };
}

/** The reason that goes into the case and the audit log. */
export const CASE_REASON = "Wrote in the anti-bot channel";
