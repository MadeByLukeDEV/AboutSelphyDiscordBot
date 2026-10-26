"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { addYoutubeChannelAction, removeYoutubeChannelAction, setYoutubeChannelEnabledAction } from "../actions";
import { MAX_YOUTUBE_CHANNELS, type YoutubeChannelResult, type YoutubeChannelView } from "../schema";

/** The YouTube channels whose uploads are announced: add by ID or link, pause, remove. Each change is saved at once. */
export function YoutubeChannels({ initial }: { initial: YoutubeChannelView[] }) {
  const t = useTranslations("Youtube.channels");
  const te = useTranslations("Youtube.errors");
  const [channels, setChannels] = useState(initial);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  const apply = (result: YoutubeChannelResult, onOk?: () => void) => {
    if (result.ok) {
      setChannels(result.channels);
      onOk?.();
    } else {
      toast.error(te(result.error));
    }
  };

  return (
    <section aria-labelledby="yt-channels" className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="yt-channels" className="text-fluid-lg font-bold">
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("help")}</p>
      </div>

      {channels.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {channels.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3">
              <div className="min-w-[12rem] flex-1">
                <p className="truncate font-medium">{c.name || t("unnamed")}</p>
                <p className="truncate font-mono text-xs text-muted-foreground">{c.ytChannelId}</p>
              </div>
              <Badge variant={c.enabled ? "default" : "secondary"}>{c.enabled ? t("on") : t("off")}</Badge>
              <Switch
                aria-label={c.name || c.ytChannelId}
                checked={c.enabled}
                disabled={pending}
                onCheckedChange={(enabled) => startTransition(async () => apply(await setYoutubeChannelEnabledAction(c.id, enabled)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t("removeConfirm"))) startTransition(async () => apply(await removeYoutubeChannelAction(c.id)));
                }}
              >
                <Trash2 aria-hidden className="size-4" />
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          startTransition(async () => apply(await addYoutubeChannelAction({ input }), () => setInput("")));
        }}
      >
        <div className="flex flex-wrap gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("placeholder")} maxLength={200} aria-label={t("placeholder")} className="min-w-[14rem] flex-1" />
          <Button type="submit" disabled={pending || channels.length >= MAX_YOUTUBE_CHANNELS || !input.trim()}>
            <Plus aria-hidden className="size-4" />
            {t("add")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("idHelp", { max: MAX_YOUTUBE_CHANNELS })}</p>
      </form>
    </section>
  );
}
