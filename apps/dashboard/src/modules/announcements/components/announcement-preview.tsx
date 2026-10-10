"use client";

import { useTranslations } from "next-intl";
import { colorToHexString } from "../color";

export type PreviewProps = {
  content: string;
  embedEnabled: boolean;
  embedTitle: string;
  embedDescription: string;
  embedColor: number;
  hasImage: boolean;
  /** The role that would be pinged, by name (null = nobody). */
  roleName: string | null;
};

/**
 * A look-alike of the Discord message. Text only: the picture is shown as a box,
 * because the dashboard never loads an address staff typed (the CSP would block it,
 * and a stranger's server shouldn't see who opens this page).
 */
export function AnnouncementPreview({ content, embedEnabled, embedTitle, embedDescription, embedColor, hasImage, roleName }: PreviewProps) {
  const t = useTranslations("Announcements.preview");
  const showEmbed = embedEnabled && (embedTitle.trim() !== "" || embedDescription.trim() !== "");
  const empty = !content.trim() && !showEmbed && !roleName;

  return (
    <figure aria-label={t("label")} className="flex flex-col gap-2">
      <figcaption className="text-xs font-medium text-muted-foreground">{t("label")}</figcaption>
      <div className="flex gap-3 rounded-xl bg-[#313338] p-3 text-[#dbdee1]">
        <span aria-hidden className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          AS
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="flex items-baseline gap-2 text-sm">
            <span className="font-semibold text-white">{t("botName")}</span>
            <span className="rounded bg-[#5865f2] px-1 text-[0.625rem] font-semibold text-white uppercase">{t("bot")}</span>
          </p>
          {empty && <p className="text-sm text-[#949ba4]">{t("empty")}</p>}
          {(roleName || content.trim()) && (
            <p className="text-sm break-words whitespace-pre-wrap">
              {roleName && <span className="mr-1 rounded bg-[#5865f2]/30 px-1 font-medium text-[#c9cdfb]">@{roleName}</span>}
              {content.trim()}
            </p>
          )}
          {showEmbed && (
            <div className="flex max-w-[28rem] overflow-hidden rounded bg-[#2b2d31]">
              <span className="w-1 shrink-0" style={{ backgroundColor: colorToHexString(embedColor) }} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
                {embedTitle.trim() && <p className="text-sm font-semibold break-words text-white">{embedTitle.trim()}</p>}
                {embedDescription.trim() && <p className="text-sm break-words whitespace-pre-wrap">{embedDescription.trim()}</p>}
                {hasImage && (
                  <div aria-hidden className="mt-1 flex aspect-video w-full items-center justify-center rounded bg-[#1e1f22] text-xs text-[#949ba4]">
                    {t("image")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </figure>
  );
}
