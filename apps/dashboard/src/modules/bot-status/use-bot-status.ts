"use client";

import { useEffect, useState } from "react";
import type { BotHealth } from "@aboutselphy/shared";

export type Status = { online: false } | { online: true; health: BotHealth };

const POLL_MS = 15_000;

/**
 * The bot's health, polled in the browser, not during the page render: a slow
 * or down bot must not slow the dashboard's page load. `status` is null until
 * the first answer arrives (show a skeleton), and `online: false` when the bot
 * can't be reached.
 */
export function useBotStatus() {
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

/** online = everything works, degraded = up but the gateway or the database is down. */
export function levelOf(status: Status | null): "online" | "degraded" | "offline" | null {
  if (!status) return null;
  if (!status.online) return "offline";
  return status.health.ok ? "online" : "degraded";
}
