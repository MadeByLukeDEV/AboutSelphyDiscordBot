"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { BotHealth } from "@aboutselphy/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Status = { online: false } | { online: true; health: BotHealth };

const POLL_MS = 15_000;

// Fetched in the browser, not during the page render: a slow or down bot must
// not slow the dashboard's page load (same reasoning as Social's Twitch tab).
function useBotStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let next: Status = { online: false };
      try {
        const res = await fetch("/api/bot/status", { cache: "no-store" });
        if (res.ok) next = (await res.json()) as Status;
      } catch {
        // stays offline
      }
      if (!cancelled) {
        setStatus(next);
        setCheckedAt(new Date());
      }
    }
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { status, checkedAt };
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function BotStatusCard() {
  const t = useTranslations("BotStatus");
  const format = useFormatter();
  const { status, checkedAt } = useBotStatus();

  const level = !status ? null : !status.online ? "offline" : status.health.ok ? "online" : "degraded";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle>{t("title")}</CardTitle>
        {level === null ? (
          <Skeleton className="h-5 w-16 rounded-4xl" />
        ) : (
          <Badge
            variant={level === "online" ? "default" : level === "degraded" ? "secondary" : "destructive"}
            aria-live="polite"
          >
            {t(level)}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {status === null ? (
          <div className="flex flex-col gap-3" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : !status.online ? (
          <p className="text-sm text-muted-foreground">{t("offlineHint")}</p>
        ) : (
          <dl className="divide-y">
            <Row
              label={t("gateway")}
              value={status.health.gatewayReady ? t("gatewayReady") : t("gatewayDown")}
            />
            <Row label={t("ping")} value={status.health.pingMs === null ? "–" : `${status.health.pingMs} ms`} />
            <Row
              label={t("database")}
              value={status.health.database ? t("databaseOk") : t("databaseDown")}
            />
            <Row label={t("uptime")} value={formatUptime(status.health.uptimeSeconds)} />
            <Row label={t("version")} value={status.health.version} />
          </dl>
        )}
        {checkedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("checkedAt", { time: format.dateTime(checkedAt, { timeStyle: "medium" }) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
