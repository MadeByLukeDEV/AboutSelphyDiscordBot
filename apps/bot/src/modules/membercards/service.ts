import type { MemberCardKind } from "@aboutselphy/shared/member-card";
import { fillDate } from "@aboutselphy/shared/member-card";
import { log } from "../../lib/log";
import { fetchAvatar, renderWelcomeCard } from "../welcome";
import { readCardImage, readCardSettings } from "./repository";

// The picture drawn for a birthday or a reminder: the member's avatar and name on the admin's own
// image (or a plain background), drawn by the same code as the welcome card. A card is a nicety:
// every caller sends its message without it when drawing fails, so nothing here throws.

const BRAND = 0x00ffa8;

export type MemberCardArgs = {
  kind: MemberCardKind;
  username: string;
  /** The member's avatar address on Discord's CDN; null draws their initial. */
  avatarUrl: string | null;
  title: string;
  subtitle: string;
  mode: "background" | "sticker";
};

export async function renderMemberCard(args: MemberCardArgs): Promise<Uint8Array | null> {
  try {
    return await renderWelcomeCard({
      username: args.username,
      avatar: args.avatarUrl ? await fetchAvatar(args.avatarUrl) : null,
      title: args.title,
      subtitle: args.subtitle,
      color: BRAND,
      mode: args.mode,
      image: await readCardImage(args.kind),
    });
  } catch (err) {
    log.error({ err, kind: args.kind }, "member card failed, sending without it");
    return null;
  }
}

/** A sample card from the SAVED settings, for the dashboard preview. */
export async function renderMemberCardPreview(kind: MemberCardKind): Promise<Uint8Array> {
  if (kind === "birthday") {
    const c = await readCardSettings("birthday");
    return render({ kind, username: "Selphy", avatarUrl: null, title: c.cardTitle, subtitle: fillDate(c.cardSubtitle ?? "", "29 February"), mode: c.cardMode === "sticker" ? "sticker" : "background" });
  }
  const c = await readCardSettings("reminder");
  return render({ kind, username: "Selphy", avatarUrl: null, title: c.cardTitle, subtitle: "Call mom at 6 pm", mode: c.cardMode === "sticker" ? "sticker" : "background" });
}

async function render(args: MemberCardArgs): Promise<Uint8Array> {
  const png = await renderMemberCard(args);
  if (!png) throw new Error("could not draw the sample card");
  return png;
}
