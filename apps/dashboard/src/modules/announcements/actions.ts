"use server";

import { announcementInput, announcementTemplateInput } from "@aboutselphy/shared/announcement";
import { z } from "zod";
import { AuthorizationError, requireStaff } from "@/modules/auth";
import type { StaffSession } from "@/modules/auth";
import type { DeleteAnnouncementResult, SaveAnnouncementResult, TemplateResult } from "./schema";
import { removeAnnouncement, removeTemplate, saveAnnouncement, saveTemplate } from "./service";
import { audited } from "@/modules/audit";

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

async function saveAnnouncementActionRun(input: unknown): Promise<SaveAnnouncementResult> {
  const session = await staff();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = announcementInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveAnnouncement(parsed.data, session.user);
}

async function deleteAnnouncementActionRun(id: unknown): Promise<DeleteAnnouncementResult> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  if (typeof id !== "string" || id.length === 0 || id.length > 64) return { ok: false, error: "invalid" };
  return removeAnnouncement(id);
}

export async function saveAnnouncementAction(...args: Parameters<typeof saveAnnouncementActionRun>): ReturnType<typeof saveAnnouncementActionRun> {
  return audited("announcements.saveAnnouncement", saveAnnouncementActionRun, args);
}

export async function deleteAnnouncementAction(...args: Parameters<typeof deleteAnnouncementActionRun>): ReturnType<typeof deleteAnnouncementActionRun> {
  return audited("announcements.deleteAnnouncement", deleteAnnouncementActionRun, args);
}

async function saveAnnouncementTemplateActionRun(input: unknown): Promise<TemplateResult> {
  const session = await staff();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = announcementTemplateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveTemplate(parsed.data, session.user.name);
}

async function deleteAnnouncementTemplateActionRun(input: unknown): Promise<TemplateResult> {
  if (!(await staff())) return { ok: false, error: "forbidden" };
  const parsed = z.object({ id: z.string().min(1).max(64) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return removeTemplate(parsed.data.id);
}

export async function saveAnnouncementTemplateAction(...args: Parameters<typeof saveAnnouncementTemplateActionRun>): ReturnType<typeof saveAnnouncementTemplateActionRun> {
  return audited("announcements.saveAnnouncementTemplate", saveAnnouncementTemplateActionRun, args);
}

export async function deleteAnnouncementTemplateAction(...args: Parameters<typeof deleteAnnouncementTemplateActionRun>): ReturnType<typeof deleteAnnouncementTemplateActionRun> {
  return audited("announcements.deleteAnnouncementTemplate", deleteAnnouncementTemplateActionRun, args);
}
