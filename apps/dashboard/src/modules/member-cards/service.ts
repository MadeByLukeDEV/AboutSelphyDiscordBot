import "server-only";
import { cardImageProblem, readImageInfo } from "@aboutselphy/shared/image-info";
import type { MemberCardKind } from "@aboutselphy/shared/member-card";
import { errorInfo } from "@/lib/log";
import { deleteCardImage, readCardImage, saveCardImage } from "./repository";
import type { CardImageResult, CardImageView } from "./schema";

/** What the settings page shows about the uploaded picture (never the bytes). */
export async function getCardImageView(kind: MemberCardKind): Promise<CardImageView | null> {
  const row = await readCardImage(kind);
  return row ? { width: row.width, height: row.height, uploadedByName: row.uploadedByName, uploadedAt: row.uploadedAt.toISOString() } : null;
}

/** The stored (verified) bytes, for the admin-only route that shows the picture. */
export async function getCardImageFile(kind: MemberCardKind): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const row = await readCardImage(kind);
  return row ? { bytes: new Uint8Array(row.data), contentType: row.contentType } : null;
}

/**
 * Stores the picture. The file is only trusted after its own first bytes say it is a PNG, JPEG or
 * WebP of a sane size; the type comes from those bytes, never from the upload's name or header.
 */
export async function setCardImage(kind: MemberCardKind, file: Uint8Array, by: string): Promise<CardImageResult> {
  try {
    const problem = cardImageProblem(file);
    if (problem) return { ok: false, error: problem };
    const info = readImageInfo(file)!;
    await saveCardImage(kind, { data: new Uint8Array(file), contentType: info.type, width: info.width, height: info.height, uploadedByName: by.slice(0, 100) });
    return { ok: true };
  } catch (error) {
    console.error("[member-cards] storing the picture failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function clearCardImage(kind: MemberCardKind): Promise<CardImageResult> {
  try {
    await deleteCardImage(kind);
    return { ok: true };
  } catch (error) {
    console.error("[member-cards] removing the picture failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
