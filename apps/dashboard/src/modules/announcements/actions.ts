"use server";

import { announcementInput } from "@aboutselphy/shared/announcement";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import type { StaffSession } from "@/modules/auth";
import type { DeleteAnnouncementResult, SaveAnnouncementResult } from "./schema";
import { removeAnnouncement, saveAnnouncement } from "./service";

// Public POST endpoints like every Server Action: each one checks the session itself
// (moderators and admins may use announcements), validates its input, and returns codes.

async function staff(): Promise<StaffSession | null> {
  try {
    return await requireStaff();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

export async function saveAnnouncementAction(input: unknown): Promise<SaveAnnouncementResult> {
  const session = await staff();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = announcementInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveAnnouncement(parsed.data, session.user);
}

export async function deleteAnnouncementAction(id: unknown): Promise<DeleteAnnouncementResult> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeAnnouncement(id);
}
