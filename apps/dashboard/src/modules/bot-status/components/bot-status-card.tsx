"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { levelOf, useBotStatus } from "../use-bot-status";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
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

/** The detailed view behind the shell's status pill. */
export function BotStatusCard() {
  const t = useTranslations("BotStatus");
  const format = useFormatter();
  const { status, checkedAt } = useBotStatus();
  const level = levelOf(status);

  return (
    <section aria-labelledby="bot-status-heading" className="surface flex h-full flex-col gap-3 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 id="bot-status-heading" className="text-fluid-lg font-bold">
          {t("title")}
        </h2>
        {level === null ? (
          <Skeleton className="h-5 w-16 rounded-4xl" />
        ) : (
          <Badge variant={level === "online" ? "default" : level === "degraded" ? "secondary" : "destructive"}>{t(level)}</Badge>
        )}
      </div>

      {status === null ? (
        <div className="flex flex-col gap-3" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : !status.online ? (
        <p className="text-sm text-muted-foreground">{t("offlineHint")}</p>
      ) : (
        <dl className="divide-y divide-border/60">
          <Row label={t("gateway")} value={status.health.gatewayReady ? t("gatewayReady") : t("gatewayDown")} />
          <Row label={t("ping")} value={status.health.pingMs === null ? "–" : `${status.health.pingMs} ms`} />
          <Row label={t("database")} value={status.health.database ? t("databaseOk") : t("databaseDown")} />
          <Row label={t("uptime")} value={formatUptime(status.health.uptimeSeconds)} />
          <Row label={t("version")} value={status.health.version} />
        </dl>
      )}

      {checkedAt && <p className="mt-auto text-xs text-muted-foreground">{t("checkedAt", { time: format.dateTime(checkedAt, { timeStyle: "medium" }) })}</p>}
    </section>
  );
}
