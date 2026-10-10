"use client";

import { useTranslations } from "next-intl";
import { customEmojiUrl, parseEmoji } from "@aboutselphy/shared/role-panel";
import { colorToHex } from "@aboutselphy/shared/twitch-template";

type Props = {
  title: string;
  description: string;
  color: number;
  hasImage: boolean;
  style: "buttons" | "menu" | "reactions";
  roles: Array<{ label: string; emoji: string }>;
};

function Emoji({ value }: { value: string }) {
  const parsed = parseEmoji(value);
  if (!parsed) return null;
  return parsed.kind === "custom" ? (
    // eslint-disable-next-line @next/next/no-img-element -- a small emote from Discord's CDN (allowed by the CSP)
    <img src={customEmojiUrl(parsed.id, parsed.animated, 32)} alt="" className="size-4" />
  ) : (
    <span aria-hidden>{parsed.name}</span>
  );
}

/**
 * A look-alike of the posted panel: the box with its colour, title, text and picture, and the
 * buttons (or the menu, or the reactions below it). The picture is shown as a box: the dashboard
 * never loads an address staff typed.
 */
export function PanelPreview({ title, description, color, hasImage, style, roles }: Props) {
  const t = useTranslations("Roles.panel.preview");
  const shown = roles.slice(0, 25);

  return (
    <figure aria-label={t("label")} className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">{t("label")}</figcaption>
      <div className="flex gap-3 rounded-xl bg-[#313338] p-3 text-[#dbdee1]">
        <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          AS
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold text-white">{t("botName")}</span>
            <span className="rounded bg-[#5865f2] px-1 text-[0.625rem] font-semibold text-white uppercase">{t("bot")}</span>
          </p>
          <div className="flex max-w-[30rem] overflow-hidden rounded bg-[#2b2d31]">
            <span className="w-1 shrink-0" style={{ backgroundColor: colorToHex(color) }} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
              {title.trim() && <p className="text-sm font-semibold break-words text-white">{title.trim()}</p>}
              {description.trim() && <p className="text-sm break-words whitespace-pre-wrap">{description.trim()}</p>}
              {style === "reactions" && (
                <ul className="flex flex-col text-sm">
                  {shown.map((r, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <Emoji value={r.emoji} />
                      <span>{r.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              {hasImage && (
                <div aria-hidden className="mt-1 flex aspect-video w-full items-center justify-center rounded bg-[#1e1f22] text-xs text-[#949ba4]">
                  {t("picture")}
                </div>
              )}
            </div>
          </div>
          {style === "buttons" && (
            <div className="flex flex-wrap gap-1.5">
              {shown.map((r, i) => (
                <span key={i} className="flex items-center gap-1.5 rounded bg-[#4e5058] px-3 py-1 text-sm text-white">
                  <Emoji value={r.emoji} />
                  {r.label}
                </span>
              ))}
            </div>
          )}
          {style === "menu" && <span aria-hidden className="max-w-[20rem] rounded bg-[#1e1f22] px-3 py-2 text-right text-sm text-[#949ba4]">▾</span>}
          {style === "reactions" && (
            <div className="flex flex-wrap gap-1.5">
              {shown.map((r, i) => (
                <span key={i} className="flex items-center gap-1 rounded-md bg-[#2b2d31] px-2 py-0.5 text-sm">
                  <Emoji value={r.emoji} />
                  <span className="text-xs text-[#949ba4]">1</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </figure>
  );
}
