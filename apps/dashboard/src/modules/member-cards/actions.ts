"use server";

import { MAX_CARD_IMAGE_BYTES } from "@aboutselphy/shared/image-info";
import { isMemberCardKind } from "@aboutselphy/shared/member-card";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { CardImageResult } from "./schema";
import { clearCardImage, setCardImage } from "./service";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text).

async function admin() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

export async function uploadMemberCardImageAction(kind: unknown, formData: FormData): Promise<CardImageResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  if (!isMemberCardKind(kind)) return { ok: false, error: "invalid" };
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "noFile" };
  if (file.size > MAX_CARD_IMAGE_BYTES) return { ok: false, error: "size" };
  return setCardImage(kind, new Uint8Array(await file.arrayBuffer()), session.user.name);
}

export async function removeMemberCardImageAction(kind: unknown): Promise<CardImageResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!isMemberCardKind(kind)) return { ok: false, error: "invalid" };
  return clearCardImage(kind);
}
