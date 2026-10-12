"use server";

import { welcomeSettingsSchema } from "@aboutselphy/shared/welcome";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import { MAX_CARD_IMAGE_BYTES } from "@aboutselphy/shared/image-info";
import type { CardImageResult, SaveWelcomeResult } from "./schema";
import { clearCardImage, saveWelcome, setCardImage } from "./service";
import { audited } from "@/modules/audit";

// A public POST endpoint like every Server Action: checks the session and the role itself,
// validates its input, and returns a code (never error text).
async function saveWelcomeSettingsActionRun(input: unknown): Promise<SaveWelcomeResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const parsed = welcomeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message);
    return { ok: false, error: messages.includes("needsChannel") ? "needsChannel" : messages.includes("needsText") ? "needsText" : "invalid" };
  }
  return saveWelcome(parsed.data);
}

/** Admins only: the picture for the welcome card, as a form upload. */
async function uploadCardImageActionRun(formData: FormData): Promise<CardImageResult> {
  let session;
  try {
    session = await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "noFile" };
  // Refuse before reading a huge body into memory.
  if (file.size > MAX_CARD_IMAGE_BYTES) return { ok: false, error: "size" };
  return setCardImage(new Uint8Array(await file.arrayBuffer()), session.user.name);
}

async function removeCardImageActionRun(): Promise<CardImageResult> {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, error: "forbidden" };
    throw error;
  }
  return clearCardImage();
}

export async function saveWelcomeSettingsAction(...args: Parameters<typeof saveWelcomeSettingsActionRun>): ReturnType<typeof saveWelcomeSettingsActionRun> {
  return audited("welcome.saveWelcomeSettings", saveWelcomeSettingsActionRun, args);
}

export async function uploadCardImageAction(...args: Parameters<typeof uploadCardImageActionRun>): ReturnType<typeof uploadCardImageActionRun> {
  return audited("welcome.uploadCardImage", uploadCardImageActionRun, args);
}

export async function removeCardImageAction(...args: Parameters<typeof removeCardImageActionRun>): ReturnType<typeof removeCardImageActionRun> {
  return audited("welcome.removeCardImage", removeCardImageActionRun, args);
}
