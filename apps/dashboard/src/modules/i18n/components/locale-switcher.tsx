"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LOCALES } from "../config";
import { setLocaleAction } from "../actions";

export function LocaleSwitcher() {
  const current = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {LOCALES.map((locale) => (
        <Button
          key={locale}
          type="button"
          size="sm"
          variant={current === locale ? "default" : "outline"}
          aria-pressed={current === locale}
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setLocaleAction(locale);
              router.refresh();
            })
          }
        >
          {locale.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
