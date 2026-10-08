"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "light", icon: Sun },
  { value: "dark", icon: Moon },
  { value: "system", icon: Monitor },
] as const;

function noopSubscribe() {
  return () => {};
}

// The resolved theme is only known after next-themes' inline script runs, so
// avoid a hydration mismatch with useSyncExternalStore (not useEffect+setState).
function useHasMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useHasMounted();
  const t = useTranslations("ThemeToggle");

  return (
    <div role="group" aria-label={t("label")} className="flex gap-1">
      {OPTIONS.map(({ value, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          variant={mounted && theme === value ? "default" : "outline"}
          size="icon-sm"
          aria-label={t(value)}
          aria-pressed={mounted ? theme === value : undefined}
          onClick={() => setTheme(value)}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}
