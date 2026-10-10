import "server-only";
// Private to the member-cards module: only service.ts imports this.
import { prisma } from "@aboutselphy/db";
import type { MemberCardKind } from "@aboutselphy/shared/member-card";

export type CardImageData = { data: Uint8Array<ArrayBuffer>; contentType: string; width: number; height: number; uploadedByName: string };

export const readCardImage = (kind: MemberCardKind) => prisma.memberCardImage.findUnique({ where: { kind } });

export function saveCardImage(kind: MemberCardKind, data: CardImageData) {
  return prisma.memberCardImage.upsert({ where: { kind }, update: { ...data, uploadedAt: new Date() }, create: { kind, ...data } });
}

export async function deleteCardImage(kind: MemberCardKind): Promise<void> {
  await prisma.memberCardImage.deleteMany({ where: { kind } });
}
