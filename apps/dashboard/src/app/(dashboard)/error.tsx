"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// A failing query (database down, timeout) shows this inside the shell instead
// of a blank page. The error itself is only logged, never shown: it can carry
// query details.
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Errors");
  useEffect(() => {
    console.error("[dashboard] page failed", error.digest ?? error.name);
  }, [error]);

  return (
    <div className="flex flex-col items-start gap-3 py-8" role="alert">
      <h1 className="text-fluid-2xl font-semibold">{t("loadFailedTitle")}</h1>
      <p className="text-muted-foreground">{t("loadFailedBody")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </div>
  );
}
