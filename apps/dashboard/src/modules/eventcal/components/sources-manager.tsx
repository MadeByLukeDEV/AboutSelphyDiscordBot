"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarRange, LayoutList, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EVENT_KINDS, eventSourceSchema, FETCH_MODES, gameEventSchema, MAX_EVENT_SOURCES, MAX_OVERVIEW_DAYS, MIN_OVERVIEW_DAYS } from "@aboutselphy/shared/eventcal";
import { FormDateTime } from "@/components/form/date-time-picker";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { checkEventCalendarAction, deleteEventArticleAction, deleteEventSourceAction, importEventArticleAction, postEventMonthlyAction, postEventOverviewAction, removeGameEventAction, restoreGameEventAction, saveEventSourceAction, saveGameEventAction } from "../actions";
import type { EventRow, SourceRow } from "../schema";

/** One item per line -> clean list, no duplicates. */
const parseLines = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim().replace(/\s+/g, " ");
    if (line && !seen.has(line.toLowerCase())) {
      seen.add(line.toLowerCase());
      out.push(line);
    }
  }
  return out;
};

/** "YYYY-MM-DDTHH:mm" in UTC, the value the date picker and the schema use. */
const toLocalValue = (iso: string | null): string => (iso ? iso.slice(0, 16) : "");

/** The games (sources): their settings, status, stored events, pasted articles, and the overview and monthly buttons. */
export function SourcesManager({ sources, channelOptions, channelsReady }: { sources: SourceRow[]; channelOptions: SelectOption[]; channelsReady: boolean }) {
  const t = useTranslations("Events.games");
  const te = useTranslations("Events.errors");
  const ta = useTranslations("Events.article");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ source: SourceRow | null } | null>(null);
  const [removing, setRemoving] = useState<SourceRow | null>(null);
  const [eventEdit, setEventEdit] = useState<{ source: SourceRow; event: EventRow | null } | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const anySyncing = sources.some((s) => s.syncing);

  // While the bot is reading a source (started here, by a timer or by a change) the page refreshes itself, so the result shows up on its own.
  useEffect(() => {
    if (!anySyncing && fetchingId === null) return;
    const timer = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(timer);
  }, [anySyncing, fetchingId, router]);

  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("never"));
  const eventDate = (e: EventRow) => format.dateTime(new Date(e.startsAt), e.allDay ? { dateStyle: "medium", timeZone: "UTC" } : { dateStyle: "medium", timeStyle: "short" });

  function run(job: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    startTransition(async () => {
      const result = await job();
      if (result.ok) toast.success(done);
      else toast.error(te(result.error as never));
      router.refresh();
    });
  }

  function fetchNow(source: SourceRow) {
    setFetchingId(source.id);
    startTransition(async () => {
      const result = await checkEventCalendarAction({ sourceId: source.id });
      if (result.ok) toast.success(t("fetched", { status: result.status, events: result.events, posted: result.posted, edited: result.edited }));
      else toast.error(te(result.error));
      setFetchingId(null);
      router.refresh();
    });
  }

  function importText(source: SourceRow) {
    startTransition(async () => {
      const result = await importEventArticleAction({ text: texts[source.id] ?? "", sourceId: source.id });
      if (result.ok) {
        toast.success(ta("done", { dated: result.dated, repeating: result.repeating, month: result.month }));
        setTexts((prev) => ({ ...prev, [source.id]: "" }));
        router.refresh();
      } else {
        toast.error(result.error === "unreadable" ? ta("unreadable") : result.error === "tooLong" ? ta("tooLong") : te(result.error));
      }
    });
  }

  return (
    <section aria-labelledby="ev-games" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="ev-games" className="text-fluid-lg font-bold">
            {t("title")} <span className="text-sm font-normal text-muted-foreground">{t("count", { count: sources.length, max: MAX_EVENT_SOURCES })}</span>
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <Button size="sm" disabled={sources.length >= MAX_EVENT_SOURCES || !channelsReady} onClick={() => setEditing({ source: null })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>

      {sources.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {sources.map((s) => (
            <li key={s.id} className="surface flex flex-col gap-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{s.name}</span>
                    <Badge variant={s.enabled ? "default" : "secondary"}>{s.enabled ? t("on") : t("off")}</Badge>
                    {s.icsUrl && <Badge variant="outline">{t("hasCalendar")}</Badge>}
                    {s.pageUrlTemplate && <Badge variant="outline">{t("hasPage")}</Badge>}
                  </div>
                  {s.syncing || fetchingId === s.id ? (
                    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                      {t("fetchingNow")}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("syncStatus", { time: when(s.lastFetchedAt), status: s.lastFetchStatus ?? "-" })}</p>
                  )}
                  <p className="text-sm text-muted-foreground">{t("status", { time: when(s.lastCheckedAt), status: s.lastStatus ?? "-" })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ source: s })}>
                    {t("edit")}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRemoving(s)}>
                    {t("remove")}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={pending || s.syncing} onClick={() => fetchNow(s)}>
                  {s.syncing || fetchingId === s.id ? <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> : <RefreshCw aria-hidden />}
                  {s.syncing || fetchingId === s.id ? t("fetching") : t("fetchNow")}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pending || !s.overviewChannelId} onClick={() => run(() => postEventOverviewAction({ sourceId: s.id }), t("overviewDone"))}>
                  <LayoutList aria-hidden />
                  {s.hasOverview ? t("overviewUpdate") : t("overviewPost")}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pending || !s.summaryChannelId} onClick={() => run(() => postEventMonthlyAction({ month: "current", sourceId: s.id }), t("monthlyDone"))}>
                  <CalendarRange aria-hidden />
                  {t("monthCurrent")}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={pending || !s.summaryChannelId} onClick={() => run(() => postEventMonthlyAction({ month: "next", sourceId: s.id }), t("monthlyDone"))}>
                  <CalendarRange aria-hidden />
                  {t("monthNext")}
                </Button>
              </div>

              <details className="group rounded-xl border px-4 py-3" open={s.events.length > 0 && s.events.length <= 12}>
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-semibold">
                  {t("events", { count: s.events.length })}
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setEventEdit({ source: s, event: null })}>
                      <Plus aria-hidden />
                      {t("addEvent")}
                    </Button>
                  </div>
                  {s.events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("noEvents")}</p>
                  ) : (
                    <ul className="flex flex-col divide-y text-sm">
                      {s.events.map((e) => (
                        <li key={e.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${e.removed ? "opacity-60" : ""}`}>
                          <div className="min-w-[12rem] flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">{e.title}</span>
                              <Badge variant="secondary">{t(`kind.${e.kind}` as never)}</Badge>
                              {e.origin === "manual" && <Badge variant="outline">{t("manual")}</Badge>}
                              {e.locked && e.origin !== "manual" && <Badge variant="outline">{t("edited")}</Badge>}
                              {e.removed && <Badge variant="destructive">{t("hidden")}</Badge>}
                            </div>
                            <p className="text-muted-foreground">
                              {eventDate(e)}
                              {e.items.length > 0 ? ` · ${t("itemCount", { count: e.items.length })}` : ""}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setEventEdit({ source: s, event: e })}>
                              <Pencil aria-hidden />
                              {t("edit")}
                            </Button>
                            {e.removed ? (
                              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => restoreGameEventAction({ id: e.id }), t("restored"))}>
                                <RotateCcw aria-hidden />
                                {t("restore")}
                              </Button>
                            ) : (
                              <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeGameEventAction({ id: e.id }), t("eventRemoved"))}>
                                <Trash2 aria-hidden />
                                {t("remove")}
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>

              <details className="rounded-xl border px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">{ta("title")}</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <p className="max-w-prose text-sm text-muted-foreground">{ta("intro")}</p>
                  <Field>
                    <FieldLabel htmlFor={`gs-text-${s.id}`}>{ta("label")}</FieldLabel>
                    <Textarea id={`gs-text-${s.id}`} rows={6} className="font-mono text-xs" value={texts[s.id] ?? ""} onChange={(e) => setTexts((prev) => ({ ...prev, [s.id]: e.target.value }))} placeholder={ta("placeholder")} />
                    <FieldDescription>{ta("help")}</FieldDescription>
                  </Field>
                  <div>
                    <Button type="button" size="sm" disabled={pending || (texts[s.id] ?? "").trim() === ""} onClick={() => importText(s)}>
                      {ta("import")}
                    </Button>
                  </div>
                  {s.articles.length > 0 && (
                    <ul className="flex flex-col divide-y text-sm">
                      {s.articles.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span className="min-w-0 truncate font-medium">{a.title}</span>
                          <span className="flex items-center gap-2 text-muted-foreground">
                            {ta("row", { month: a.monthKey, events: a.events })}
                            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => deleteEventArticleAction({ id: a.id }), t("articleRemoved"))}>
                              {t("remove")}
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.source ? t("editTitle") : t("newTitle")}</DialogTitle>
            <DialogDescription>{t("formIntro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <SourceForm
              key={editing.source?.id ?? "new"}
              source={editing.source}
              channelOptions={channelOptions}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={eventEdit !== null} onOpenChange={(open) => !open && setEventEdit(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{eventEdit?.event ? t("eventEditTitle") : t("eventNewTitle")}</DialogTitle>
            <DialogDescription>{t("eventFormIntro")}</DialogDescription>
          </DialogHeader>
          {eventEdit && (
            <EventForm
              key={eventEdit.event?.id ?? "new"}
              source={eventEdit.source}
              event={eventEdit.event}
              onDone={() => {
                setEventEdit(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("removeTitle")}</DialogTitle>
            <DialogDescription>{t("removeBody", { name: removing?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                const target = removing;
                if (!target) return;
                setRemoving(null);
                run(() => deleteEventSourceAction({ id: target.id }), t("removed"));
              }}
            >
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type SourceValues = { name: string; enabled: boolean; icsUrl: string; pageUrlTemplate: string; contentSelector: string; fetchMode: string; overviewChannelId: string; overviewDays: number; summaryChannelId: string; summaryAuto: boolean };

function SourceForm({ source, channelOptions, onDone }: { source: SourceRow | null; channelOptions: SelectOption[]; onDone: () => void }) {
  const t = useTranslations("Events.games");
  const te = useTranslations("Events.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<SourceValues>({
    defaultValues: source
      ? { name: source.name, enabled: source.enabled, icsUrl: source.icsUrl, pageUrlTemplate: source.pageUrlTemplate, contentSelector: source.contentSelector, fetchMode: source.fetchMode, overviewChannelId: source.overviewChannelId, overviewDays: source.overviewDays, summaryChannelId: source.summaryChannelId, summaryAuto: source.summaryAuto }
      : { name: "", enabled: true, icsUrl: "", pageUrlTemplate: "", contentSelector: "", fetchMode: "auto", overviewChannelId: "", overviewDays: 30, summaryChannelId: "", summaryAuto: false },
  });
  const { errors } = form.formState;
  const none: SelectOption[] = [{ value: "", label: t("none") }, ...channelOptions];
  const modeOptions: SelectOption[] = FETCH_MODES.map((m) => ({ value: m, label: t(`mode.${m}` as never) }));

  const submit = form.handleSubmit((values) => {
    const checked = eventSourceSchema.safeParse({ ...(source ? { id: source.id } : {}), ...values, overviewDays: Number(values.overviewDays) });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "name" || k === "overviewDays" || k === "icsUrl" || k === "pageUrlTemplate") form.setError(k, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveEventSourceAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="gs-name">{t("name")}</FieldLabel>
          <Input id="gs-name" maxLength={40} placeholder="Sea of Thieves" aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          <FieldDescription>{t("nameHelp")}</FieldDescription>
          {errors.name && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.pageUrlTemplate) || undefined}>
          <FieldLabel htmlFor="gs-page">{t("pageUrl")}</FieldLabel>
          <Input id="gs-page" type="url" autoComplete="off" maxLength={300} placeholder="https://www.seaofthieves.com/news/this-month-{month}{year}" aria-invalid={Boolean(errors.pageUrlTemplate) || undefined} {...form.register("pageUrlTemplate")} />
          <FieldDescription>{t("pageUrlHelp")}</FieldDescription>
          {errors.pageUrlTemplate && <FieldError>{te("badUrl")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="gs-selector">{t("selector")}</FieldLabel>
          <Input id="gs-selector" maxLength={200} autoComplete="off" placeholder="article, .post-content" {...form.register("contentSelector")} />
          <FieldDescription>{t("selectorHelp")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="gs-mode">{t("fetchMode")}</FieldLabel>
          <FormSelect control={form.control} name="fetchMode" id="gs-mode" options={modeOptions} placeholder={t("mode.auto")} />
          <FieldDescription>{t("fetchModeHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.icsUrl) || undefined}>
          <FieldLabel htmlFor="gs-ics">{t("icsUrl")}</FieldLabel>
          <Input id="gs-ics" type="url" autoComplete="off" maxLength={500} aria-invalid={Boolean(errors.icsUrl) || undefined} {...form.register("icsUrl")} />
          <FieldDescription>{t("icsUrlHelp")}</FieldDescription>
          {errors.icsUrl && <FieldError>{te("badUrl")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="gs-overview">{t("overviewChannel")}</FieldLabel>
          <FormSelect control={form.control} name="overviewChannelId" id="gs-overview" options={none} placeholder={t("none")} />
        </Field>
        <Field data-invalid={Boolean(errors.overviewDays) || undefined}>
          <FieldLabel htmlFor="gs-days">{t("overviewDays")}</FieldLabel>
          <Input id="gs-days" type="number" inputMode="numeric" min={MIN_OVERVIEW_DAYS} max={MAX_OVERVIEW_DAYS} className="max-w-[8rem]" {...form.register("overviewDays", { valueAsNumber: true })} />
          {errors.overviewDays && <FieldError>{te("badDays", { min: MIN_OVERVIEW_DAYS, max: MAX_OVERVIEW_DAYS })}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="gs-summary">{t("summaryChannel")}</FieldLabel>
          <FormSelect control={form.control} name="summaryChannelId" id="gs-summary" options={none} placeholder={t("none")} />
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="summaryAuto" render={({ field }) => <Switch id="gs-auto" checked={field.value} onCheckedChange={field.onChange} aria-describedby="gs-auto-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="gs-auto">{t("summaryAuto")}</FieldLabel>
            <FieldDescription id="gs-auto-help">{t("summaryAutoHelp")}</FieldDescription>
          </div>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="gs-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="gs-enabled">{t("enabled")}</FieldLabel>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}

type EventValues = { title: string; kind: string; allDay: boolean; start: string; end: string; description: string; summary: string; itemsText: string; imageUrl: string; videoUrl: string; reminderText: string };

function EventForm({ source, event, onDone }: { source: SourceRow; event: EventRow | null; onDone: () => void }) {
  const t = useTranslations("Events.games");
  const te = useTranslations("Events.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<EventValues>({
    defaultValues: event
      ? { title: event.title, kind: event.kind, allDay: event.allDay, start: toLocalValue(event.startsAt), end: toLocalValue(event.endsAt), description: event.description, summary: event.summary, itemsText: event.items.join("\n"), imageUrl: event.imageUrl, videoUrl: event.videoUrl, reminderText: event.reminderDays.join(", ") }
      : { title: "", kind: "event", allDay: true, start: "", end: "", description: "", summary: "", itemsText: "", imageUrl: "", videoUrl: "", reminderText: "" },
  });
  const { errors } = form.formState;
  const kindOptions: SelectOption[] = EVENT_KINDS.map((k) => ({ value: k, label: t(`kind.${k}` as never) }));

  const submit = form.handleSubmit((values) => {
    const checked = gameEventSchema.safeParse({
      ...(event ? { id: event.id } : {}),
      sourceId: source.id,
      title: values.title,
      kind: values.kind,
      allDay: values.allDay,
      start: values.start,
      end: values.end,
      description: values.description,
      summary: values.summary,
      items: parseLines(values.itemsText),
      imageUrl: values.imageUrl,
      videoUrl: values.videoUrl,
      reminderDays: values.reminderText.split(/[\s,;+]+/).filter(Boolean).map(Number),
    });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "title" || k === "start" || k === "end" || k === "imageUrl" || k === "videoUrl") form.setError(k, { type: "custom", message: issue.message });
        else if (k === "reminderDays") form.setError("reminderText", { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveGameEventAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("eventSaved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.title) || undefined}>
          <FieldLabel htmlFor="ge-title">{t("eventTitle")}</FieldLabel>
          <Input id="ge-title" maxLength={120} aria-invalid={Boolean(errors.title) || undefined} {...form.register("title")} />
          {errors.title && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="ge-kind">{t("eventKind")}</FieldLabel>
          <FormSelect control={form.control} name="kind" id="ge-kind" options={kindOptions} placeholder={t("kind.event")} />
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="allDay" render={({ field }) => <Switch id="ge-allday" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="ge-allday">{t("allDay")}</FieldLabel>
        </Field>
        <Field data-invalid={Boolean(errors.start) || undefined}>
          <FieldLabel htmlFor="ge-start">{t("start")}</FieldLabel>
          <FormDateTime control={form.control} name="start" id="ge-start" invalid={Boolean(errors.start)} />
          {errors.start && <FieldError>{te("badDate")}</FieldError>}
          <FieldDescription>{t("utcHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.end) || undefined}>
          <FieldLabel htmlFor="ge-end">{t("end")}</FieldLabel>
          <FormDateTime control={form.control} name="end" id="ge-end" invalid={Boolean(errors.end)} />
          {errors.end && <FieldError>{te("badDate")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="ge-desc">{t("description")}</FieldLabel>
          <Textarea id="ge-desc" rows={5} maxLength={4000} {...form.register("description")} />
        </Field>
        <Field>
          <FieldLabel htmlFor="ge-summary">{t("summary")}</FieldLabel>
          <Textarea id="ge-summary" rows={2} maxLength={600} {...form.register("summary")} />
          <FieldDescription>{t("summaryHelp")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="ge-items">{t("items")}</FieldLabel>
          <Textarea id="ge-items" rows={4} {...form.register("itemsText")} />
          <FieldDescription>{t("itemsHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.imageUrl) || undefined}>
          <FieldLabel htmlFor="ge-image">{t("imageUrl")}</FieldLabel>
          <Input id="ge-image" type="url" maxLength={500} autoComplete="off" aria-invalid={Boolean(errors.imageUrl) || undefined} {...form.register("imageUrl")} />
          {errors.imageUrl && <FieldError>{te("badImage")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.videoUrl) || undefined}>
          <FieldLabel htmlFor="ge-video">{t("videoUrl")}</FieldLabel>
          <Input id="ge-video" type="url" maxLength={500} autoComplete="off" aria-invalid={Boolean(errors.videoUrl) || undefined} {...form.register("videoUrl")} />
          <FieldDescription>{t("videoHelp")}</FieldDescription>
          {errors.videoUrl && <FieldError>{te("badVideo")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.reminderText) || undefined}>
          <FieldLabel htmlFor="ge-reminders">{t("reminders")}</FieldLabel>
          <Input id="ge-reminders" inputMode="numeric" autoComplete="off" placeholder="7, 2" className="max-w-[12rem]" aria-invalid={Boolean(errors.reminderText) || undefined} {...form.register("reminderText")} />
          <FieldDescription>{t("remindersHelp")}</FieldDescription>
          {errors.reminderText && <FieldError>{te("badLeadDays", { max: 4, limit: 60 })}</FieldError>}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
