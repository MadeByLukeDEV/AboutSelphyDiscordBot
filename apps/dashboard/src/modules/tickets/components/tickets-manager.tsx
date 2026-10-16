"use client";

import { PageTabs } from "@/components/page/page-tabs";
import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { colorToHex, hexToColor } from "@aboutselphy/shared/twitch-template";
import { DEFAULT_TICKET_COLOR, MAX_AUTOCLOSE_HOURS, MAX_CLAIMS_PER_STAFF, MAX_OPEN_PER_USER, MAX_STAFF_ROLES, MAX_TICKET_TEXT, ticketSettingsSchema, type TicketCategoryInput, type TicketSettings } from "@aboutselphy/shared/tickets";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { MultiPicker } from "@/components/form/multi-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { postPanelAction, saveTicketSettingsAction } from "../actions";
import type { TicketRow } from "../schema";
import { ColorPicker } from "@/components/form/color-picker";
import { TicketCategories } from "./ticket-categories";
import { EmoteInsert } from "@/components/form/emote-insert";

/** The ticket list for staff, and (for admins) the settings and the button that posts the panel. */
export function TicketsManager({
  initial,
  panelPosted,
  tickets,
  channels,
  roles,
  categories,
  ratings,
  canEdit,
  initialTab,
}: {
  initial: TicketSettings;
  panelPosted: boolean;
  tickets: TicketRow[];
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  categories: TicketCategoryInput[];
  ratings: { average: number | null; count: number };
  canEdit: boolean;
  initialTab?: string;
}) {
  const t = useTranslations("Tickets");
  const te = useTranslations("Tickets.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<TicketSettings>({ resolver: zodResolver(ticketSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const color = useWatch({ control: form.control, name: "panelColor" });

  const opt = (kind: "text" | "category", empty: string): SelectOption[] => [
    { value: "", label: empty },
    ...(channels ?? []).filter((c) => c.kind === kind).map((c) => ({ value: c.id, label: kind === "category" ? c.name : c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: kind === "category" ? c.name : `#${c.name}`, group: kind === "text" ? (c.parent ?? undefined) : undefined })),
  ];
  const textOptions = opt("text", t("noChannel"));
  const categoryOptions = opt("category", t("noChannel"));
  for (const [options, id] of [[textOptions, initial.panelChannelId], [textOptions, initial.logChannelId], [categoryOptions, initial.categoryId]] as const) {
    if (id && !options.some((o) => o.value === id)) options.push({ value: id, label: id });
  }
  const roleItems = roles && roles.map((r) => ({ id: r.id, label: r.name }));

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveTicketSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  function post() {
    startTransition(async () => {
      const result = await postPanelAction();
      if (result.ok) {
        toast.success(result.status === "posted" ? t("panel.posted") : t("panel.updated"));
        router.refresh();
      } else {
        toast.error(t(`panel.errors.${result.error}`));
      }
    });
  }

  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const channelField = (name: "panelChannelId" | "categoryId" | "logChannelId", label: string, help: string, options: SelectOption[]) => (
    <Field data-invalid={Boolean(errors[name]) || undefined}>
      <FieldLabel htmlFor={`tk-${name}`}>{label}</FieldLabel>
      <FormSelect control={form.control} name={name} id={`tk-${name}`} options={options} placeholder={t("channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors[name])} />
      <FieldDescription>{channels === null ? t("form.botOffline") : help}</FieldDescription>
      {errors[name] && <FieldError>{te(name === "panelChannelId" ? "needsPanelChannel" : "needsCategory")}</FieldError>}
    </Field>
  );

  return (
    <div className="flex flex-col gap-fluid">
      <PageTabs
        initial={initialTab}
        tabs={[
          {
            id: "tickets",
            label: t("tabs.tickets"),
            content: (
              <>
              <section aria-labelledby="tk-list" className="flex flex-col gap-3">
                <h2 id="tk-list" className="text-fluid-lg font-bold">
                  {t("list.title")}
                </h2>
                {ratings.count > 0 && ratings.average !== null && <p className="text-sm text-muted-foreground">{t("list.rating", { average: ratings.average.toFixed(1), count: ratings.count })}</p>}
                {tickets.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-8 text-center">
                    <h3 className="font-semibold">{t("list.empty.title")}</h3>
                    <p className="max-w-md text-sm text-muted-foreground">{t("list.empty.body")}</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {tickets.map((k) => (
                      <li key={k.id}>
                        <Link href={`/tickets/${k.number}`} className="surface surface-interactive flex overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                          <span className={cn("w-1.5 shrink-0", k.status === "open" ? "bg-primary" : "bg-muted-foreground/40")} aria-hidden />
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                            <span className="w-14 shrink-0 text-fluid-lg font-semibold tabular-nums">#{k.number}</span>
                            <div className="min-w-[10rem] flex-1">
                              <p className="truncate font-medium">{k.openerName || k.openerId}</p>
                              <p className="truncate text-sm text-muted-foreground">
                                {when(k.createdAt)}
                                {k.claimedByName ? ` · ${t("list.claimed", { name: k.claimedByName })}` : ""}
                                {k.closedByName ? ` · ${t("list.closedBy", { name: k.closedByName })}` : ""}
                                {k.categoryLabel ? ` · ${k.categoryLabel}` : ""}
                                {k.rating ? ` · ${"★".repeat(k.rating)}${"☆".repeat(5 - k.rating)}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {k.status === "closed" && <span className="text-xs text-muted-foreground">{k.hasTranscript ? t("list.messages", { count: k.messageCount }) : t("list.noTranscript")}</span>}
                              <Badge variant={k.status === "open" ? "default" : "secondary"}>{k.status === "open" ? t("list.open") : t("list.closed")}</Badge>
                            </div>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              </>
            ),
          },
...(canEdit ? [
          {
            id: "settings",
            label: t("tabs.settings"),
            content: (
              <>
              {canEdit && (
                <form onSubmit={onSubmit} className="surface flex flex-col gap-5 p-5" noValidate>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
                    <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
                  </div>
                  <FieldGroup>
                    <Field orientation="horizontal">
                      <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="tk-enabled" checked={field.value} onCheckedChange={field.onChange} aria-describedby="tk-enabled-help" />} />
                      <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor="tk-enabled">{t("form.enabled")}</FieldLabel>
                        <FieldDescription id="tk-enabled-help">{t("form.enabledHelp")}</FieldDescription>
                      </div>
                    </Field>
                    {channelField("panelChannelId", t("form.panelChannel"), t("form.panelChannelHelp"), textOptions)}
                    {channelField("categoryId", t("form.category"), t("form.categoryHelp"), categoryOptions)}
                    <Field data-invalid={Boolean(errors.staffRoleIds) || undefined}>
                      <FieldLabel htmlFor="tk-staff">{t("form.staff", { max: MAX_STAFF_ROLES })}</FieldLabel>
                      <Controller
                        control={form.control}
                        name="staffRoleIds"
                        render={({ field }) => (
                          <MultiPicker
                            id="tk-staff"
                            value={field.value}
                            onChange={field.onChange}
                            items={roleItems}
                            max={MAX_STAFF_ROLES}
                            labels={{ selected: t("form.staffSelected"), none: t("form.staffNone"), search: t("form.staffSearch"), noMatch: t("form.noMatch"), full: t("form.staffFull", { max: MAX_STAFF_ROLES }), offline: t("form.botOffline"), remove: (name) => t("form.remove", { name }) }}
                          />
                        )}
                      />
                      <FieldDescription>{t("form.staffHelp")}</FieldDescription>
                      {errors.staffRoleIds && <FieldError>{te("needsStaff")}</FieldError>}
                    </Field>
                    {channelField("logChannelId", t("form.logChannel"), t("form.logChannelHelp"), textOptions)}
                    <Field>
                      <FieldLabel htmlFor="tk-max">{t("form.maxOpen")}</FieldLabel>
                      <Input id="tk-max" type="number" inputMode="numeric" min={1} max={MAX_OPEN_PER_USER} className="max-w-[8rem]" {...form.register("maxOpenPerUser", { valueAsNumber: true })} />
                      <FieldDescription>{t("form.maxOpenHelp")}</FieldDescription>
                    </Field>
                    <Field orientation="horizontal">
                      <Controller control={form.control} name="askReason" render={({ field }) => <Switch id="tk-ask" checked={field.value} onCheckedChange={field.onChange} />} />
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor="tk-ask">{t("form.askReason")}</FieldLabel>
                        <FieldDescription>{t("form.askReasonHelp")}</FieldDescription>
                      </div>
                    </Field>
                    <Field orientation="horizontal">
                      <Controller control={form.control} name="askRating" render={({ field }) => <Switch id="tk-rating" checked={field.value} onCheckedChange={field.onChange} />} />
                      <div className="flex flex-col gap-0.5">
                        <FieldLabel htmlFor="tk-rating">{t("form.askRating")}</FieldLabel>
                        <FieldDescription>{t("form.askRatingHelp")}</FieldDescription>
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="tk-autoclose">{t("form.autoClose")}</FieldLabel>
                      <Input id="tk-autoclose" type="number" inputMode="numeric" min={0} max={MAX_AUTOCLOSE_HOURS} className="max-w-[8rem]" {...form.register("autoCloseHours", { valueAsNumber: true })} />
                      <FieldDescription>{t("form.autoCloseHelp", { max: MAX_AUTOCLOSE_HOURS })}</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="tk-claims">{t("form.maxClaims")}</FieldLabel>
                      <Input id="tk-claims" type="number" inputMode="numeric" min={0} max={MAX_CLAIMS_PER_STAFF} className="max-w-[8rem]" {...form.register("maxClaimsPerStaff", { valueAsNumber: true })} />
                      <FieldDescription>{t("form.maxClaimsHelp", { max: MAX_CLAIMS_PER_STAFF })}</FieldDescription>
                    </Field>

                    <Field><FieldLabel htmlFor="tk-title">{t("form.panelTitle")}</FieldLabel><Input id="tk-title" maxLength={256} {...form.register("panelTitle")} /></Field>
                    <Field><FieldLabel htmlFor="tk-desc">{t("form.panelDescription")}</FieldLabel><Textarea id="tk-desc" rows={2} maxLength={2000} {...form.register("panelDescription")} />
        <EmoteInsert targetId="tk-desc" /></Field>
                    <Field><FieldLabel htmlFor="tk-button">{t("form.buttonLabel")}</FieldLabel><Input id="tk-button" maxLength={80} {...form.register("buttonLabel")} /></Field>
                    <Field>
                      <FieldLabel htmlFor="tk-welcome">{t("form.welcome")}</FieldLabel>
                      <Textarea id="tk-welcome" rows={3} maxLength={MAX_TICKET_TEXT} {...form.register("welcomeTemplate")} />
        <EmoteInsert targetId="tk-welcome" />
                      <FieldDescription>{t("form.welcomeHelp")}</FieldDescription>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="tk-color">{t("form.color")}</FieldLabel>
                      <div className="flex items-center gap-2">
                        <ColorPicker id="tk-color" value={colorToHex(color)} onChange={(hex) => {
                            const next = hexToColor(hex);
                            if (next !== undefined) form.setValue("panelColor", next, { shouldDirty: true });
                          }} />
                        <Button type="button" variant="ghost" size="sm" onClick={() => form.setValue("panelColor", DEFAULT_TICKET_COLOR, { shouldDirty: true })}>
                          {t("form.colorReset")}
                        </Button>
                      </div>
                    </Field>
                  </FieldGroup>

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={pending || !isDirty}>
                      {pending ? t("form.saving") : t("form.save")}
                    </Button>
                    <Button type="button" variant="outline" disabled={pending || isDirty || !initial.enabled} onClick={post}>
                      {panelPosted ? t("panel.update") : t("panel.post")}
                    </Button>
                    <p className="text-xs text-muted-foreground">{isDirty ? t("panel.saveFirst") : panelPosted ? t("panel.updateHelp") : t("panel.postHelp")}</p>
                  </div>
                </form>
              )}

              {canEdit && <TicketCategories initial={categories} channels={channels} roles={roles} />}
              </>
            ),
          },
          ] : []),
        ]}
      />
    </div>
  );
}
