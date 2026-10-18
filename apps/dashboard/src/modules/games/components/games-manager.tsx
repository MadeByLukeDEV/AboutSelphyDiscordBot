"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { gameSettingsSchema, MAX_GAME_CHANNELS, STAT_GAMES, type GameSettings } from "@aboutselphy/shared/games";
import { MultiPicker, type PickItem } from "@/components/form/multi-picker";
import { EmptyState } from "@/components/page/empty-state";
import { PageTabs } from "@/components/page/page-tabs";
import { SaveBar } from "@/components/page/save-bar";
import { Section } from "@/components/page/section";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { saveGamesAction } from "../actions";
import type { TopByGame } from "../schema";
import { Trophy } from "lucide-react";

const SWITCHES = ["triviaOn", "rpsOn", "tictactoeOn", "connect4On", "wordOn", "funOn"] as const;

/** The minigames' settings (XP, limits, which games, where) and the best players. One form for all settings, saved from the bar at the bottom. */
export function GamesManager({ initial, channels, top, initialTab }: { initial: GameSettings; channels: GuildChannel[] | null; top: TopByGame; initialTab?: string }) {
  const t = useTranslations("Games");
  const te = useTranslations("Games.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<GameSettings>({ resolver: zodResolver(gameSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;

  const channelItems: PickItem[] | null = channels && channels.map((c) => ({ id: c.id, label: c.kind === "category" ? c.name : `#${c.name}` }));
  const pickerLabels = {
    selected: t("channels.selected"),
    none: t("channels.none"),
    search: t("channels.search"),
    noMatch: t("channels.noMatch"),
    full: t("channels.full", { max: MAX_GAME_CHANNELS }),
    offline: t("channels.offline"),
    remove: (name: string) => t("channels.remove", { name }),
  };

  const onSubmit = form.handleSubmit(
    (values) =>
      startTransition(async () => {
        const result = await saveGamesAction(values);
        if (result.ok) {
          toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
          form.reset(result.settings);
          router.refresh();
        } else {
          toast.error(te(result.error));
        }
      }),
    () => toast.error(te("invalid")),
  );

  const num = (name: "winXp" | "dailyXpCap" | "cooldownSeconds", max: number) => (
    <Field data-invalid={Boolean(errors[name]) || undefined}>
      <FieldLabel htmlFor={`gm-${name}`}>{t(`xp.${name}`)}</FieldLabel>
      <Input id={`gm-${name}`} type="number" inputMode="numeric" min={0} max={max} className="max-w-[8rem]" aria-invalid={Boolean(errors[name]) || undefined} {...form.register(name, { valueAsNumber: true })} />
      <FieldDescription>{t(`xp.${name}Help`)}</FieldDescription>
      {errors[name] && <FieldError>{te("invalid")}</FieldError>}
    </Field>
  );

  const settings = (
    <>
      <Section title={t("games.title")} description={t("games.intro")}>
        <FieldGroup>
          {SWITCHES.map((name) => (
            <Field key={name} orientation="horizontal">
              <Controller control={form.control} name={name} render={({ field }) => <Switch id={`gm-${name}`} checked={field.value} onCheckedChange={field.onChange} aria-describedby={`gm-${name}-help`} />} />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor={`gm-${name}`}>{t(`games.${name}`)}</FieldLabel>
                <FieldDescription id={`gm-${name}-help`}>{t(`games.${name}Help`)}</FieldDescription>
              </div>
            </Field>
          ))}
        </FieldGroup>
      </Section>
      <Section title={t("xp.title")} description={t("xp.intro")}>
        <FieldGroup>
          {num("winXp", 100)}
          {num("dailyXpCap", 5000)}
          {num("cooldownSeconds", 600)}
        </FieldGroup>
      </Section>
      <Section title={t("channels.title")} description={t("channels.intro")}>
        <Field>
          <FieldLabel htmlFor="gm-channels">{t("channels.label")}</FieldLabel>
          <Controller control={form.control} name="allowedChannelIds" render={({ field }) => <MultiPicker id="gm-channels" value={field.value} onChange={field.onChange} items={channelItems} max={MAX_GAME_CHANNELS} labels={pickerLabels} />} />
        </Field>
      </Section>
    </>
  );

  const board = (
    <div className="grid gap-fluid md:grid-cols-2">
      {STAT_GAMES.map((game) => (
        <Section key={game} title={t(`top.games.${game}`)}>
          {top[game].length === 0 ? (
            <EmptyState icon={Trophy} title={t("top.emptyTitle")} description={t("top.emptyBody")} />
          ) : (
            <ol className="flex flex-col divide-y text-sm">
              {top[game].map((r, i) => (
                <li key={r.userId} className="flex items-center gap-3 py-2">
                  <span className="w-6 shrink-0 text-center font-bold tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">{t("top.record", { wins: format.number(r.wins), played: format.number(r.played) })}</span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-fluid">
      <PageTabs
        initial={initialTab}
        tabs={[
          { id: "settings", label: t("tabs.settings"), content: settings },
          { id: "top", label: t("tabs.top"), content: board },
        ]}
      />
      <SaveBar dirty={isDirty} pending={pending} onSave={() => void onSubmit()} onDiscard={() => form.reset(initial)} label={t("form.save")} savingLabel={t("form.saving")} dirtyLabel={t("form.unsaved")} discardLabel={t("form.discard")} />
    </div>
  );
}
