"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import type { TempVoiceOverview, TempVoiceRoom } from "@aboutselphy/shared";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type State = { online: false } | { online: true; overview: TempVoiceOverview };

const POLL_MS = 8_000;

// Read in the browser, not during the page render: it's live data that changes by
// the minute, and a slow or down bot must not hold up the settings below it.
function useOverview() {
  const [state, setState] = useState<State | null>(null);
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let next: State = { online: false };
      try {
        const res = await fetch("/api/tempvoice/overview", { cache: "no-store" });
        if (res.ok) next = (await res.json()) as State;
      } catch {
        // stays offline
      }
      if (!cancelled) {
        setState(next);
        setAt(new Date());
      }
    }
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { state, at };
}

function Room({ room }: { room: TempVoiceRoom }) {
  const t = useTranslations("TempVoice.monitor");
  const format = useFormatter();
  const shownLimit = room.userLimit > 0 ? t("membersOfMax", { count: room.memberCount, max: room.userLimit }) : t("members", { count: room.memberCount });

  return (
    <li className="flex overflow-hidden rounded-xl border bg-card">
      <span className={cn("w-1.5 shrink-0", room.locked ? "bg-amber-500" : "bg-emerald-500")} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="min-w-0 truncate font-semibold">{room.name}</h3>
          <Badge variant={room.locked ? "secondary" : "outline"}>{room.locked ? t("locked") : t("open")}</Badge>
          <span className="text-sm text-muted-foreground tabular-nums">{shownLimit}</span>
        </div>

        <p className="text-sm text-muted-foreground">{room.ownerName ? t("owner", { name: room.ownerName }) : t("ownerGone")}</p>

        <p className="text-sm">
          <span className="text-muted-foreground">{t("inRoom")}: </span>
          {room.members.length > 0 ? room.members.map((m) => m.name).join(", ") : <span className="text-muted-foreground">{t("noPeople")}</span>}
          {room.memberCount > room.members.length ? ` +${room.memberCount - room.members.length}` : ""}
        </p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {!room.videoAllowed && <span>{t("videoOff")}</span>}
          {!room.soundboardAllowed && <span>{t("soundboardOff")}</span>}
          {room.allowedCount > 0 && <span>{t("allowed", { count: room.allowedCount })}</span>}
          {room.blockedCount > 0 && <span>{t("blocked", { count: room.blockedCount })}</span>}
          <time dateTime={room.createdAt} title={format.dateTime(new Date(room.createdAt), { dateStyle: "medium", timeStyle: "short" })}>
            {t("created", { time: format.relativeTime(new Date(room.createdAt)) })}
          </time>
        </div>
      </div>
    </li>
  );
}

export function RoomsMonitor({ enabled }: { enabled: boolean }) {
  const t = useTranslations("TempVoice.monitor");
  const format = useFormatter();
  const { state, at } = useOverview();

  const rooms = state?.online ? state.overview.rooms : [];
  const people = rooms.reduce((n, r) => n + r.memberCount, 0);

  return (
    <section aria-labelledby="rooms-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="rooms-heading" className="text-fluid-lg font-semibold">
          {t("title")}
        </h2>
        {state?.online && (
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {t("summary", { rooms: rooms.length, people })}
          </p>
        )}
      </div>

      {state?.online && state.overview.missingPermissions.length > 0 && (
        <div role="alert" className="flex gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div>
            <p className="font-medium">{t("missingTitle")}</p>
            <p className="text-muted-foreground">{t("missingBody", { list: state.overview.missingPermissions.join(", ") })}</p>
          </div>
        </div>
      )}

      {state === null ? (
        <div className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[6.5rem] rounded-xl" />
          ))}
        </div>
      ) : !state.online ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">{t("offline")}</p>
      ) : rooms.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {rooms.map((room) => (
            <Room key={room.channelId} room={room} />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{enabled ? t("empty.title") : t("off.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{enabled ? t("empty.body") : t("off.body")}</p>
        </div>
      )}

      {at && state?.online && (
        <p className="text-xs text-muted-foreground">{t("updated", { time: format.dateTime(at, { timeStyle: "medium" }) })}</p>
      )}
    </section>
  );
}
