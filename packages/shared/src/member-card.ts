import { z } from "zod";
import { CARD_MODES, MAX_CARD_SUBTITLE, MAX_CARD_TITLE } from "./welcome";

// Settings of the optional picture the bot draws for a birthday or a reminder, like the welcome
// card. One definition for the dashboard and the bot. Pure. Import it from
// "@aboutselphy/shared/member-card" in client components.

export const MEMBER_CARD_KINDS = ["birthday", "reminder"] as const;
export type MemberCardKind = (typeof MEMBER_CARD_KINDS)[number];
export const isMemberCardKind = (v: unknown): v is MemberCardKind => MEMBER_CARD_KINDS.includes(v as MemberCardKind);

export const memberCardFields = {
  cardEnabled: z.boolean(),
  cardMode: z.enum(CARD_MODES),
  cardTitle: z.string().trim().min(1).max(MAX_CARD_TITLE),
};
export const memberCardSubtitle = z.string().trim().max(MAX_CARD_SUBTITLE);

/** Fills {date} in a birthday card's subtitle. */
export function fillDate(template: string, date: string): string {
  return template.replace(/\{date\}/g, date).trim();
}
