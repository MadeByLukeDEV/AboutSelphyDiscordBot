"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Smile } from "lucide-react";
import { emojisResponse, type GuildEmoji } from "@aboutselphy/shared";
import { customEmojiUrl } from "@aboutselphy/shared/role-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// A small button next to a text field that inserts one of the server's own emotes at the cursor. The bot turns the inserted
// markup (<:name:id>) into the real emote when it posts; typing :name: by hand works too. The emotes are fetched the first time
// the button is opened. The text is put into the field the way typing would, so forms built on react-hook-form notice it.

/** Puts `text` at the cursor of the text field with this id (or at its end), and tells the form about it. */
export function insertIntoField(fieldId: string, text: string): void {
  const el = document.getElementById(fieldId);
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  // React tracks the value through the element's own setter, so use that one: a plain assignment would be ignored.
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  const caret = start + text.length;
  el.setSelectionRange(caret, caret);
}

export function EmoteInsert({ targetId }: { targetId: string }) {
  const t = useTranslations("EmoteInsert");
  const [emotes, setEmotes] = useState<GuildEmoji[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");

  async function load() {
    if (emotes !== null) return;
    try {
      const res = await fetch("/api/bot/emojis", { cache: "no-store" });
      const parsed = emojisResponse.safeParse(res.ok ? await res.json() : null);
      if (parsed.success) setEmotes(parsed.data.emojis);
      else setFailed(true);
    } catch {
      setFailed(true);
    }
  }

  const shown = (emotes ?? []).filter((e) => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 120);

  return (
    <Popover onOpenChange={(open) => open && void load()}>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="sm" aria-label={t("button")} title={t("button")} />}>
        <Smile aria-hidden />
        {t("button")}
      </PopoverTrigger>
      <PopoverContent className="flex w-[18rem] flex-col gap-2 p-3" align="start">
        {failed ? (
          <p className="text-sm text-muted-foreground">{t("failed")}</p>
        ) : emotes === null ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : emotes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <>
            <Input aria-label={t("search")} placeholder={t("search")} value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="grid max-h-56 grid-cols-6 gap-1 overflow-y-auto">
              {shown.map((e) => (
                <button key={e.id} type="button" title={`:${e.name}:`} aria-label={e.name} onClick={() => insertIntoField(targetId, e.value)} className="flex size-9 items-center justify-center rounded-md hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a 32 px emote from Discord's CDN (allowed by the CSP) */}
                  <img src={customEmojiUrl(e.id, e.animated)} alt="" width={28} height={28} loading="lazy" className="size-7" />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("hint")}</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
