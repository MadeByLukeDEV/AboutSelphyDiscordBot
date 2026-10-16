"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { ANNOUNCE_MODES, RESET_MODES, DEFAULT_ANNOUNCE_TEMPLATE, MAX_ANNOUNCE_TEMPLATE, MAX_BOOST_PERCENT, MAX_BOOSTS, MAX_LEVEL, MAX_NO_XP, MAX_REWARDS, MIN_BOOST_PERCENT, levelSettingsSchema, type LevelSettings } from "@aboutselphy/shared/levels";
import { FormDateTime } from "@/components/form/date-time-picker";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveLevelSettingsAction } from "../actions";
import type { LeaderboardRow } from "../schema";
import { MultiPicker, type PickItem } from "@/components/form/multi-picker";
import { EmoteInsert } from "@/components/form/emote-insert";

/** Settings, level rewards and the leaderboard. */
export function LevelsManager({
  initial,
  leaderboard,
  total,
  channels,
  roles,
}: {
  initial: LevelSettings;
  leaderboard: LeaderboardRow[];
  total: number;
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
}) {
  const t = useTranslations("Levels");
  const te = useTranslations("Levels.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<LevelSettings>({ resolver: zodResolver(levelSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const rewards = useFieldArray({ control: form.control, name: "rewards" });
  const boosts = useFieldArray({ control: form.control, name: "boosts" });
  const announce = useWatch({ control: form.control, name: "announce" });

  const textChannels: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).filter((c) => c.kind === "text").map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.announceChannelId && !textChannels.some((o) => o.value === initial.announceChannelId)) textChannels.push({ value: initial.announceChannelId, label: initial.announceChannelId });

  const channelItems: PickItem[] | null = channels && channels.map((c) => ({ id: c.id, label: c.kind === "category" ? c.name : c.kind === "voice" ? `🔊 ${c.name}` : `#${c.name}` }));
  const roleItems: PickItem[] | null = roles && roles.map((r) => ({ id: r.id, label: r.name }));
  const rewardRoleOptions: SelectOption[] = (roles ?? []).filter((r) => r.assignable).map((r) => ({ value: r.id, label: r.name }));
  for (const r of initial.rewards) if (!rewardRoleOptions.some((o) => o.value === r.roleId)) rewardRoleOptions.push({ value: r.roleId, label: roles?.find((x) => x.id === r.roleId)?.name ?? r.roleId });
  // A boost can go to any role (it hands out XP, not the role), so every role is offered.
  const boostRoleOptions: SelectOption[] = (roles ?? []).map((r) => ({ value: r.id, label: r.name }));
  for (const b of initial.boosts) if (!boostRoleOptions.some((o) => o.value === b.roleId)) boostRoleOptions.push({ value: b.roleId, label: b.roleId });
  const resetOptions: SelectOption[] = RESET_MODES.map((m) => ({ value: m, label: t(`reset.modes.${m}`) }));
  const modeOptions: SelectOption[] = ANNOUNCE_MODES.map((m) => ({ value: m, label: t(`announce.modes.${m}`) }));

  const pickerLabels = (kind: "channels" | "roles") => ({
    selected: t(`noXp.${kind}Selected`),
    none: t("noXp.none"),
    search: t(`noXp.${kind}Search`),
    noMatch: t("noXp.noMatch"),
    full: t("noXp.full", { max: MAX_NO_XP }),
    offline: t("noXp.offline"),
    remove: (name: string) => t("noXp.remove", { name }),
  });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveLevelSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  const num = (name: "xpMin" | "xpMax" | "cooldownSeconds" | "voiceXpPerMinute", label: string, help: string, max: number) => (
    <Field data-invalid={Boolean(errors[name]) || undefined}>
      <FieldLabel htmlFor={`lv-${name}`}>{label}</FieldLabel>
      <Input id={`lv-${name}`} type="number" inputMode="numeric" min={0} max={max} className="max-w-[8rem]" aria-invalid={Boolean(errors[name]) || undefined} {...form.register(name, { valueAsNumber: true })} />
      <FieldDescription>{help}</FieldDescription>
      {errors[name] && <FieldError>{te(name === "xpMax" && errors.xpMax?.message === "range" ? "xpRange" : "invalid")}</FieldError>}
    </Field>
  );

  const card = (id: string, title: string, body: string, children: React.ReactNode) => (
    <section aria-labelledby={id} className="surface flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="text-fluid-lg font-bold">
          {title}
        </h2>
        <p className="max-w-prose text-sm text-muted-foreground">{body}</p>
      </div>
      <FieldGroup>{children}</FieldGroup>
    </section>
  );

  return (
    <div className="flex flex-col gap-fluid">
      <form onSubmit={onSubmit} className="flex flex-col gap-fluid" noValidate>
        {card(
          "lv-xp",
          t("xp.title"),
          t("xp.intro"),
          <>
            <Field orientation="horizontal">
              <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="lv-enabled" checked={field.value} onCheckedChange={field.onChange} aria-describedby="lv-enabled-help" />} />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="lv-enabled">{t("xp.enabled")}</FieldLabel>
                <FieldDescription id="lv-enabled-help">{t("xp.enabledHelp")}</FieldDescription>
              </div>
            </Field>
            <div className="flex flex-wrap gap-4">
              {num("xpMin", t("xp.min"), t("xp.minHelp"), 100)}
              {num("xpMax", t("xp.max"), t("xp.maxHelp"), 100)}
            </div>
            {num("cooldownSeconds", t("xp.cooldown"), t("xp.cooldownHelp"), 3600)}
            {num("voiceXpPerMinute", t("xp.voice"), t("xp.voiceHelp"), 50)}
          </>,
        )}

        {card(
          "lv-announce",
          t("announce.title"),
          t("announce.intro"),
          <>
            <Field>
              <FieldLabel htmlFor="lv-announce-mode">{t("announce.mode")}</FieldLabel>
              <FormSelect control={form.control} name="announce" id="lv-announce-mode" options={modeOptions} placeholder={t("announce.mode")} />
            </Field>
            {announce === "channel" && (
              <Field data-invalid={Boolean(errors.announceChannelId) || undefined}>
                <FieldLabel htmlFor="lv-announce-channel">{t("announce.channel")}</FieldLabel>
                <FormSelect control={form.control} name="announceChannelId" id="lv-announce-channel" options={textChannels} placeholder={t("announce.channel")} disabled={channels === null} invalid={Boolean(errors.announceChannelId)} />
                {errors.announceChannelId && <FieldError>{te("needsChannel")}</FieldError>}
              </Field>
            )}
            {announce !== "off" && (
              <Field>
                <FieldLabel htmlFor="lv-template">{t("announce.message")}</FieldLabel>
                <Textarea id="lv-template" rows={2} maxLength={MAX_ANNOUNCE_TEMPLATE} {...form.register("announceTemplate")} />
<EmoteInsert targetId="lv-template" />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button type="button" variant="ghost" size="xs" onClick={() => form.setValue("announceTemplate", DEFAULT_ANNOUNCE_TEMPLATE, { shouldDirty: true })}>
                    {t("announce.reset")}
                  </Button>
                </div>
                <FieldDescription>{t("announce.messageHelp")}</FieldDescription>
              </Field>
            )}
          </>,
        )}

        {card(
          "lv-rewards",
          t("rewards.title"),
          t("rewards.intro", { max: MAX_REWARDS }),
          <>
            <Field orientation="horizontal">
              <Controller control={form.control} name="stackRoles" render={({ field }) => <Switch id="lv-stack" checked={field.value} onCheckedChange={field.onChange} aria-describedby="lv-stack-help" />} />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="lv-stack">{t("rewards.stack")}</FieldLabel>
                <FieldDescription id="lv-stack-help">{t("rewards.stackHelp")}</FieldDescription>
              </div>
            </Field>
            <Field orientation="horizontal">
              <Controller control={form.control} name="voiceRequiresUnmuted" render={({ field }) => <Switch id="lv-unmuted" checked={field.value} onCheckedChange={field.onChange} aria-describedby="lv-unmuted-help" />} />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="lv-unmuted">{t("unmuted.label")}</FieldLabel>
                <FieldDescription id="lv-unmuted-help">{t("unmuted.help")}</FieldDescription>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="lv-reset">{t("reset.label")}</FieldLabel>
              <FormSelect control={form.control} name="resetEvery" id="lv-reset" options={resetOptions} placeholder={t("reset.label")} />
              <FieldDescription>{t("reset.help")}</FieldDescription>
            </Field>
            <Field data-invalid={Boolean(form.formState.errors.eventBoostUntil) || undefined}>
              <FieldLabel htmlFor="lv-event-boost">{t("eventBoost.label")}</FieldLabel>
              <div className="flex flex-wrap items-end gap-3">
                <Input id="lv-event-boost" type="number" inputMode="numeric" min={100} max={MAX_BOOST_PERCENT} className="max-w-[8rem]" {...form.register("eventBoostPercent", { valueAsNumber: true })} />
                <div className="min-w-[14rem] flex-1">
                  <FormDateTime control={form.control} name="eventBoostUntil" id="lv-event-boost-until" invalid={Boolean(form.formState.errors.eventBoostUntil)} />
                </div>
              </div>
              <FieldDescription>{t("eventBoost.help")}</FieldDescription>
              {form.formState.errors.eventBoostUntil && <FieldError>{t("eventBoost.needsEnd")}</FieldError>}
            </Field>
            <Field orientation="horizontal">
              <Controller control={form.control} name="publicLeaderboard" render={({ field }) => <Switch id="lv-public" checked={field.value} onCheckedChange={field.onChange} aria-describedby="lv-public-help" />} />
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor="lv-public">{t("public.label")}</FieldLabel>
                <FieldDescription id="lv-public-help">{t("public.help")}</FieldDescription>
              </div>
            </Field>
            {rewards.fields.length === 0 && <p className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">{t("rewards.empty")}</p>}
            <ul className="flex flex-col gap-3">
              {rewards.fields.map((field, index) => (
                <li key={field.id} className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
                  <Field className="w-28">
                    <FieldLabel htmlFor={`lv-reward-level-${index}`}>{t("rewards.level")}</FieldLabel>
                    <Input id={`lv-reward-level-${index}`} type="number" inputMode="numeric" min={1} max={MAX_LEVEL} {...form.register(`rewards.${index}.level`, { valueAsNumber: true })} />
                  </Field>
                  <Field className="min-w-[12rem] flex-1">
                    <FieldLabel htmlFor={`lv-reward-role-${index}`}>{t("rewards.role")}</FieldLabel>
                    <FormSelect control={form.control} name={`rewards.${index}.roleId`} id={`lv-reward-role-${index}`} options={rewardRoleOptions} placeholder={t("rewards.rolePlaceholder")} disabled={roles === null} />
                  </Field>
                  <Button type="button" variant="ghost" size="sm" onClick={() => rewards.remove(index)}>
                    <Trash2 aria-hidden />
                    {t("rewards.remove")}
                  </Button>
                </li>
              ))}
            </ul>
            {errors.rewards && <FieldError>{te("rewardsInvalid")}</FieldError>}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => rewards.append({ level: (initial.rewards.at(-1)?.level ?? 0) + 5, roleId: "" })} disabled={rewards.fields.length >= MAX_REWARDS}>
                <Plus aria-hidden />
                {t("rewards.add")}
              </Button>
            </div>
          </>,
        )}

        {card(
          "lv-boosts",
          t("boosts.title"),
          t("boosts.intro", { max: MAX_BOOSTS }),
          <>
            {boosts.fields.length === 0 && <p className="rounded-xl border border-dashed px-4 py-4 text-sm text-muted-foreground">{t("boosts.empty")}</p>}
            <ul className="flex flex-col gap-3">
              {boosts.fields.map((field, index) => (
                <li key={field.id} className="flex flex-wrap items-end gap-3 rounded-xl border p-3">
                  <Field className="min-w-[12rem] flex-1">
                    <FieldLabel htmlFor={`lv-boost-role-${index}`}>{t("boosts.role")}</FieldLabel>
                    <FormSelect control={form.control} name={`boosts.${index}.roleId`} id={`lv-boost-role-${index}`} options={boostRoleOptions} placeholder={t("boosts.rolePlaceholder")} disabled={roles === null} />
                  </Field>
                  <Field className="w-32">
                    <FieldLabel htmlFor={`lv-boost-percent-${index}`}>{t("boosts.percent")}</FieldLabel>
                    <Input id={`lv-boost-percent-${index}`} type="number" inputMode="numeric" min={MIN_BOOST_PERCENT} max={MAX_BOOST_PERCENT} {...form.register(`boosts.${index}.percent`, { valueAsNumber: true })} />
                  </Field>
                  <Button type="button" variant="ghost" size="sm" onClick={() => boosts.remove(index)}>
                    <Trash2 aria-hidden />
                    {t("boosts.remove")}
                  </Button>
                </li>
              ))}
            </ul>
            {errors.boosts && <FieldError>{te("boostsInvalid", { min: MIN_BOOST_PERCENT, max: MAX_BOOST_PERCENT })}</FieldError>}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => boosts.append({ roleId: "", percent: 150 })} disabled={boosts.fields.length >= MAX_BOOSTS}>
                <Plus aria-hidden />
                {t("boosts.add")}
              </Button>
            </div>
          </>,
        )}

        {card(
          "lv-noxp",
          t("noXp.title"),
          t("noXp.intro"),
          <>
            <Field>
              <FieldLabel htmlFor="lv-noxp-channels">{t("noXp.channels")}</FieldLabel>
              <Controller control={form.control} name="noXpChannelIds" render={({ field }) => <MultiPicker id="lv-noxp-channels" value={field.value} onChange={field.onChange} items={channelItems} max={MAX_NO_XP} labels={pickerLabels("channels")} />} />
            </Field>
            <Field>
              <FieldLabel htmlFor="lv-noxp-roles">{t("noXp.roles")}</FieldLabel>
              <Controller control={form.control} name="noXpRoleIds" render={({ field }) => <MultiPicker id="lv-noxp-roles" value={field.value} onChange={field.onChange} items={roleItems} max={MAX_NO_XP} labels={pickerLabels("roles")} />} />
            </Field>
          </>,
        )}

        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>

      <section aria-labelledby="lv-board" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="lv-board" className="text-fluid-lg font-bold">
              {t("board.title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("board.intro", { count: total })}</p>
          </div>
        </div>
        {leaderboard.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-8 text-center">
            <h3 className="font-semibold">{t("board.empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("board.empty.body")}</p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {leaderboard.map((m, i) => (
              <li key={m.userId} className="surface flex items-center gap-3 px-4 py-3">
                <span className="w-8 shrink-0 text-center text-lg font-bold tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{t("board.stats", { messages: format.number(m.messages), minutes: format.number(m.voiceMinutes) })}</p>
                </div>
                <Badge variant="secondary">{t("board.level", { level: m.level })}</Badge>
                <span className="w-24 text-right text-sm tabular-nums">{format.number(m.xp)} XP</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
