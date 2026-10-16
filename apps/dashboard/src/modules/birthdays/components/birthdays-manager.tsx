"use client";

import { SaveRow } from "@/components/page/save-row";
import { PageTabs } from "@/components/page/page-tabs";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { birthdaySettingsSchema, MAX_BIRTHDAY_MESSAGE, type BirthdaySettings } from "@aboutselphy/shared/birthdays";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MemberCardSettings } from "@/modules/member-cards/components/member-card-settings";
import type { CardImageView } from "@/modules/member-cards/schema";
import { removeBirthdayAction, saveBirthdaySettingsAction, setBirthdayAction } from "../actions";
import type { BirthdayRow } from "../schema";
import { EmoteInsert } from "@/components/form/emote-insert";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** The birthday settings and the next birthdays. State flows in as props; saving calls router.refresh(). */
export function BirthdaysManager({ initial, birthdays, total, channels, roles, cardImage, initialTab }: { initialTab?: string; initial: BirthdaySettings; birthdays: BirthdayRow[]; total: number; channels: GuildChannel[] | null; roles: GuildRole[] | null; cardImage: CardImageView | null }) {
  const t = useTranslations("Birthdays");
  const te = useTranslations("Birthdays.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<BirthdaySettings>({ resolver: zodResolver(birthdaySettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const channelOptions: SelectOption[] = [
    { value: "", label: t("none") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.channelId && !channelOptions.some((o) => o.value === initial.channelId)) channelOptions.push({ value: initial.channelId, label: initial.channelId });
  const roleOptions: SelectOption[] = [{ value: "", label: t("none") }, ...(roles ?? []).filter((r) => r.assignable).map((r) => ({ value: r.id, label: r.name }))];
  if (initial.roleId && !roleOptions.some((o) => o.value === initial.roleId)) roleOptions.push({ value: initial.roleId, label: initial.roleId });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveBirthdaySettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  const [staff, setStaff] = useState({ userId: "", month: "", day: "", year: "" });

  function addStaffBirthday() {
    startTransition(async () => {
      const result = await setBirthdayAction({
        userId: staff.userId.replace(/[<@!>\s]/g, ""),
        month: Number(staff.month),
        day: Number(staff.day),
        year: staff.year.trim() === "" ? null : Number(staff.year),
      });
      if (result.ok) {
        toast.success(t("staff.saved"));
        setStaff({ userId: "", month: "", day: "", year: "" });
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  function remove(userId: string) {
    startTransition(async () => {
      const result = await removeBirthdayAction({ userId });
      if (result.ok) router.refresh();
      else toast.error(te(result.error));
    });
  }

  return (
    <div className="flex flex-col gap-fluid">
      <PageTabs
        initial={initialTab}
        tabs={[
          {
            id: "list",
            label: t("tabs.list"),
            count: total,
            content: (
              <>
              <section aria-labelledby="bd-list" className="flex flex-col gap-3">
                <h2 id="bd-list" className="text-fluid-lg font-bold">
                  {t("list.title")} <span className="text-sm font-normal text-muted-foreground">{t("list.total", { count: total })}</span>
                </h2>
                {birthdays.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
                    <h3 className="font-semibold">{t("list.empty.title")}</h3>
                    <p className="max-w-md text-sm text-muted-foreground">{t("list.empty.body")}</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {birthdays.map((b) => (
                      <li key={b.userId} className="surface flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                        <span className="min-w-[10rem] flex-1 font-semibold">{b.name}</span>
                        <span className="text-sm text-muted-foreground">
                          {b.day} {MONTHS[b.month - 1]}
                        </span>
                        <Badge variant={b.inDays === 0 ? "default" : "secondary"}>{b.inDays === 0 ? t("list.today") : t("list.inDays", { count: b.inDays })}</Badge>
                        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => remove(b.userId)}>
                          {t("staff.remove")}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              </>
            ),
          },
          {
            id: "settings",
            label: t("tabs.settings"),
            content: (
              <>
              <form onSubmit={onSubmit} className="surface flex flex-col gap-5 p-5" noValidate>
                <div className="flex flex-col gap-1">
                  <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
                  <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
                </div>
                <FieldGroup>
                  <Field orientation="horizontal">
                    <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="bd-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
                    <FieldLabel htmlFor="bd-enabled">{t("form.enabled")}</FieldLabel>
                  </Field>
                  <Field data-invalid={Boolean(errors.channelId) || undefined}>
                    <FieldLabel htmlFor="bd-channel">{t("form.channel")}</FieldLabel>
                    <FormSelect control={form.control} name="channelId" id="bd-channel" options={channelOptions} placeholder={t("form.channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
                    <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
                    {errors.channelId && <FieldError>{te("needsTarget")}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bd-role">{t("form.role")}</FieldLabel>
                    <FormSelect control={form.control} name="roleId" id="bd-role" options={roleOptions} placeholder={t("none")} disabled={roles === null} />
                    <FieldDescription>{t("form.roleHelp")}</FieldDescription>
                  </Field>
                  <Field data-invalid={Boolean(errors.message) || undefined}>
                    <FieldLabel htmlFor="bd-message">{t("form.message")}</FieldLabel>
                    <Textarea id="bd-message" rows={3} maxLength={MAX_BIRTHDAY_MESSAGE} aria-invalid={Boolean(errors.message) || undefined} {...form.register("message")} />
        <EmoteInsert targetId="bd-message" />
                    <FieldDescription>{t("form.messageHelp")}</FieldDescription>
                    {errors.message && <FieldError>{te("needsMessage")}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bd-milestone">{t("form.milestone")}</FieldLabel>
                    <Textarea id="bd-milestone" rows={2} maxLength={MAX_BIRTHDAY_MESSAGE} {...form.register("milestoneMessage")} />
                    <FieldDescription>{t("form.milestoneHelp")}</FieldDescription>
                  </Field>
                  <Field orientation="horizontal">
                    <Controller control={form.control} name="monthlySummary" render={({ field }) => <Switch id="bd-summary" checked={field.value} onCheckedChange={field.onChange} aria-describedby="bd-summary-help" />} />
                    <div className="flex flex-col gap-1">
                      <FieldLabel htmlFor="bd-summary">{t("form.summary")}</FieldLabel>
                      <FieldDescription id="bd-summary-help">{t("form.summaryHelp")}</FieldDescription>
                    </div>
                  </Field>
                  <Field data-invalid={Boolean(errors.timeZone) || undefined}>
                    <FieldLabel htmlFor="bd-zone">{t("form.timeZone")}</FieldLabel>
                    <Input id="bd-zone" className="max-w-xs" maxLength={64} aria-invalid={Boolean(errors.timeZone) || undefined} {...form.register("timeZone")} />
                    <FieldDescription>{t("form.timeZoneHelp")}</FieldDescription>
                    {errors.timeZone && <FieldError>{te("badTimeZone")}</FieldError>}
                  </Field>
                </FieldGroup>
                <MemberCardSettings kind="birthday" form={form} cardImage={cardImage} withSubtitle />
                <SaveRow dirty={isDirty} pending={pending} label={t("form.save")} savingLabel={t("form.saving")} />
              </form>
              </>
            ),
          },
          {
            id: "staff",
            label: t("tabs.staff"),
            content: (
              <>
              <section aria-labelledby="bd-staff" className="surface flex flex-col gap-3 p-5">
                <h2 id="bd-staff" className="text-fluid-lg font-bold">
                  {t("staff.title")}
                </h2>
                <p className="max-w-prose text-sm text-muted-foreground">{t("staff.intro")}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <Field className="w-56">
                    <FieldLabel htmlFor="bd-staff-id">{t("staff.member")}</FieldLabel>
                    <Input id="bd-staff-id" inputMode="numeric" autoComplete="off" placeholder="123456789012345678" value={staff.userId} onChange={(e) => setStaff({ ...staff, userId: e.target.value })} />
                  </Field>
                  <Field className="w-20">
                    <FieldLabel htmlFor="bd-staff-month">{t("staff.month")}</FieldLabel>
                    <Input id="bd-staff-month" type="number" inputMode="numeric" min={1} max={12} value={staff.month} onChange={(e) => setStaff({ ...staff, month: e.target.value })} />
                  </Field>
                  <Field className="w-20">
                    <FieldLabel htmlFor="bd-staff-day">{t("staff.day")}</FieldLabel>
                    <Input id="bd-staff-day" type="number" inputMode="numeric" min={1} max={31} value={staff.day} onChange={(e) => setStaff({ ...staff, day: e.target.value })} />
                  </Field>
                  <Field className="w-24">
                    <FieldLabel htmlFor="bd-staff-year">{t("staff.year")}</FieldLabel>
                    <Input id="bd-staff-year" type="number" inputMode="numeric" value={staff.year} onChange={(e) => setStaff({ ...staff, year: e.target.value })} />
                  </Field>
                  <Button type="button" disabled={pending || staff.userId.trim() === "" || staff.month === "" || staff.day === ""} onClick={addStaffBirthday}>
                    {t("staff.save")}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{t("staff.help")}</p>
              </section>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
