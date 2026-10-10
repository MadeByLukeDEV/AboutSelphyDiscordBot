"use client";

import { useTranslations } from "next-intl";
import { colorToHex, fillTemplate, twitchChannelUrl } from "@aboutselphy/shared/twitch-template";

export type PreviewProps = {
  template: string;
  color: number;
  showThumbnail: boolean;
  showGame: boolean;
  /** The role that would be pinged, by name (null = nobody). */
  roleName: string | null;
  /** The streamer's display name, or the login typed so far. */
  name: string;
  login: string;
};

// Sample facts, so the preview shows what the placeholders turn into.
const SAMPLE_TITLE = "Chill stream and good vibes";
const SAMPLE_GAME = "Just Chatting";

/**
 * A look-alike of the Discord message, built with the same template function the
 * bot uses. It shows plain text only: the bot escapes everything Twitch supplies,
 * so nothing a streamer types can add markdown or mentions.
 */
export function MessagePreview({ template, color, showThumbnail, showGame, roleName, name, login }: PreviewProps) {
  const t = useTranslations("Twitch.preview");
  const displayName = name || login || t("sampleName");
  const handle = login || displayName;
  const text = fillTemplate(template, {
    name: displayName,
    login: handle,
    title: SAMPLE_TITLE,
    game: SAMPLE_GAME,
    url: twitchChannelUrl(handle),
  });

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
          <p className="text-sm break-words whitespace-pre-wrap">
            {roleName && <span className="mr-1 rounded bg-[#5865f2]/30 px-1 font-medium text-[#c9cdfb]">@{roleName}</span>}
            {text}
          </p>
          <div className="flex max-w-[26rem] overflow-hidden rounded bg-[#2b2d31]">
            <span className="w-1 shrink-0" style={{ backgroundColor: colorToHex(color) }} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
              <p className="text-xs font-semibold text-white">{t("author", { name: displayName })}</p>
              <p className="text-sm font-semibold break-words text-[#00a8fc]">{SAMPLE_TITLE}</p>
              {showGame && (
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-white">{t("playing")}</span>
                  <span>{SAMPLE_GAME}</span>
                </div>
              )}
              {showThumbnail && (
                <div
                  aria-hidden
                  className="mt-1 flex aspect-video w-full items-center justify-center rounded bg-[#1e1f22] text-xs text-[#949ba4]"
                >
                  {t("thumbnail")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
