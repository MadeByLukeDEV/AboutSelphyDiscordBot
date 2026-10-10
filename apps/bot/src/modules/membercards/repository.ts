// Private to the membercards module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";
import type { MemberCardKind } from "@aboutselphy/shared/member-card";

/** The image the admin uploaded for this kind of card, or null. */
export async function readCardImage(kind: MemberCardKind): Promise<Uint8Array | null> {
  const row = await prisma.memberCardImage.findUnique({ where: { kind } });
  return row ? new Uint8Array(row.data) : null;
}

/** The SAVED card settings of a kind (the preview draws from these). */
export async function readCardSettings(kind: MemberCardKind): Promise<{ cardMode: string; cardTitle: string; cardSubtitle?: string }> {
  if (kind === "birthday") {
    const c = await prisma.birthdayConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
    return { cardMode: c.cardMode, cardTitle: c.cardTitle, cardSubtitle: c.cardSubtitle };
  }
  const c = await prisma.reminderConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return { cardMode: c.cardMode, cardTitle: c.cardTitle };
}
