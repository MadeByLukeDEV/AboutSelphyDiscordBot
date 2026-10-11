import type { ModGuideInput, ModGuidePreview } from "@aboutselphy/shared/modguide";

// Types shared by the service, the actions and the client components. No server-only imports.

export type ModGuideError = "forbidden" | "invalid" | "needsChannel" | "botUnavailable" | "channelNotFound" | "channelNotUsable" | "failed";
export type SaveModGuideResult = { ok: true; settings: ModGuideInput } | { ok: false; error: ModGuideError };
export type PostModGuideResult = { ok: true; messages: number } | { ok: false; error: ModGuideError };

export type ModGuidePageData = {
  settings: ModGuideInput;
  /** When the bot last posted it, as ISO text (null: never). */
  postedAt: string | null;
  /** The command categories the bot lists, or null when the bot can't be reached. */
  preview: ModGuidePreview | null;
};
