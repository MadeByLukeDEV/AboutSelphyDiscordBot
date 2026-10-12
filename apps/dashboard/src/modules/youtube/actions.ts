"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { youtubeSettingsSchema, type SaveYoutubeResult } from "./schema";
import { saveYoutube } from "./service";
import { audited } from "@/modules/audit";

// A public POST endpoint like every Server Action: checks the session and the role itself,
// validates its input, and returns a code (never error text).
async function saveYoutubeSettingsActionRun(input: unknown): Promise<SaveYoutubeResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = youtubeSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.some((i) => i.message === "needsChannel") ? "needsChannel" : "invalid" };
  return saveYoutube(parsed.data);
}

export async function saveYoutubeSettingsAction(...args: Parameters<typeof saveYoutubeSettingsActionRun>): ReturnType<typeof saveYoutubeSettingsActionRun> {
  return audited("youtube.saveYoutubeSettings", saveYoutubeSettingsActionRun, args);
}
