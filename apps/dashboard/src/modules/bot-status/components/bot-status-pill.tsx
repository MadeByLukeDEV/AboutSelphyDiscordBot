"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { levelOf, useBotStatus } from "../use-bot-status";

const DOT: Record<"online" | "degraded" | "offline", string> = {
  online: "bg-primary",
  degraded: "bg-amber-500",
  offline: "bg-destructive",
};

/** A compact "is the bot alive" indicator for the shell: a dot, the state and the gateway ping. */
export function BotStatusPill({ className }: { className?: string }) {
  const t = useTranslations("BotStatus");
  const { status } = useBotStatus();
  const level = levelOf(status);

  if (level === null) return <Skeleton className={cn("h-8 w-28 rounded-full", className)} aria-hidden />;

  const ping = status?.online && status.health.pingMs !== null ? `${status.health.pingMs} ms` : null;

  return (
    <p
      className={cn("surface inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium", className)}
      style={{ borderRadius: "9999px" }}
      aria-live="polite"
    >
      <span className="relative inline-flex size-2" aria-hidden>
        <span className={cn("relative size-2 rounded-full", DOT[level], level === "online" && "live-dot")} />
      </span>
      <span>{t(level)}</span>
      {ping && <span className="text-muted-foreground tabular-nums">{ping}</span>}
    </p>
  );
}
