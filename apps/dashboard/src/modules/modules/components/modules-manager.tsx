"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MODULE_GROUPS, MODULES } from "@aboutselphy/shared/modules";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { setModuleAction } from "../actions";
import type { ModuleState } from "../schema";

/** Every feature with an on/off switch. A switch saves at once. State flows in as props; changes call router.refresh(). */
export function ModulesManager({ modules }: { modules: ModuleState[] }) {
  const t = useTranslations("Modules");
  const te = useTranslations("Modules.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The switch moves at once; it snaps back if saving fails.
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});

  function toggle(key: ModuleState["key"], enabled: boolean) {
    setOptimistic((o) => ({ ...o, [key]: enabled }));
    startTransition(async () => {
      const result = await setModuleAction({ key, enabled });
      if (result.ok) {
        toast.success(result.botNotified ? (enabled ? t("turnedOn") : t("turnedOff")) : t("savedBotLater"));
        router.refresh();
      } else {
        toast.error(te(result.error));
        setOptimistic((o) => {
          const next = { ...o };
          delete next[key];
          return next;
        });
      }
    });
  }

  return (
    <div className="flex flex-col gap-fluid">
      {MODULE_GROUPS.map((group) => {
        const items = modules.filter((m) => MODULES[m.key].group === group);
        if (items.length === 0) return null;
        return (
          <section key={group} aria-labelledby={`mod-${group}`} className="flex flex-col gap-3">
            <h2 id={`mod-${group}`} className="text-fluid-lg font-bold">
              {t(`groups.${group}`)}
            </h2>
            <ul className="grid gap-2 md:grid-cols-2">
              {items.map((m) => {
                const on = optimistic[m.key] ?? m.enabled;
                const id = `mod-switch-${m.key}`;
                return (
                  <li key={m.key} className="surface flex items-start gap-3 px-4 py-3">
                    <Switch id={id} checked={on} disabled={pending} onCheckedChange={(v) => toggle(m.key, v)} aria-describedby={`${id}-help`} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor={id} className="font-semibold">
                          {t(`items.${m.key}.name`)}
                        </label>
                        {!on && <Badge variant="secondary">{t("off")}</Badge>}
                      </div>
                      <p id={`${id}-help`} className="text-sm text-muted-foreground">
                        {t(`items.${m.key}.description`)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
