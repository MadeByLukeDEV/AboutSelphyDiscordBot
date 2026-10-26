"use server";

import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { addYoutubeChannelSchema, youtubeSettingsSchema, type SaveYoutubeResult, type YoutubeChannelResult } from "./schema";
import { changeYoutubeChannels, saveYoutube } from "./service";
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

async function guardAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch (error) {
    if (error instanceof AuthorizationError) return false;
    throw error;
  }
}

async function addYoutubeChannelActionRun(input: unknown): Promise<YoutubeChannelResult> {
  if (!(await guardAdmin())) return { ok: false, error: "forbidden" };
  const parsed = addYoutubeChannelSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalidChannel" };
  return changeYoutubeChannels({ add: parsed.data.input });
}

async function setYoutubeChannelEnabledActionRun(id: unknown, enabled: unknown): Promise<YoutubeChannelResult> {
  if (!(await guardAdmin())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length > 40 || typeof enabled !== "boolean") return { ok: false, error: "invalid" };
  return changeYoutubeChannels({ toggle: id, enabled });
}

async function removeYoutubeChannelActionRun(id: unknown): Promise<YoutubeChannelResult> {
  if (!(await guardAdmin())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length > 40) return { ok: false, error: "invalid" };
  return changeYoutubeChannels({ remove: id });
}

export async function addYoutubeChannelAction(...args: Parameters<typeof addYoutubeChannelActionRun>): ReturnType<typeof addYoutubeChannelActionRun> {
  return audited("youtube.addYoutubeChannel", addYoutubeChannelActionRun, args);
}

export async function setYoutubeChannelEnabledAction(...args: Parameters<typeof setYoutubeChannelEnabledActionRun>): ReturnType<typeof setYoutubeChannelEnabledActionRun> {
  return audited("youtube.setYoutubeChannelEnabled", setYoutubeChannelEnabledActionRun, args);
}

export async function removeYoutubeChannelAction(...args: Parameters<typeof removeYoutubeChannelActionRun>): ReturnType<typeof removeYoutubeChannelActionRun> {
  return audited("youtube.removeYoutubeChannel", removeYoutubeChannelActionRun, args);
}
