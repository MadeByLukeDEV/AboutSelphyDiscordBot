"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { youtubeSettingsSchema, type SaveYoutubeResult } from "./schema";
import { saveYoutube } from "./service";

// A public POST endpoint like every Server Action: checks the session and the role itself,
// validates its input, and returns a code (never error text).
export async function saveYoutubeSettingsAction(input: unknown): Promise<SaveYoutubeResult> {
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
