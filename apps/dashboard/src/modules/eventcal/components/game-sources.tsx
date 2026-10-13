"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarRange, LayoutList, Plus } from "lucide-react";
import { toast } from "sonner";
import { eventSourceSchema, MAX_EVENT_SOURCES, MAX_OVERVIEW_DAYS, MIN_OVERVIEW_DAYS } from "@aboutselphy/shared/eventcal";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteEventArticleAction, deleteEventSourceAction, importEventArticleAction, postEventMonthlyAction, postEventOverviewAction, saveEventSourceAction } from "../actions";
import type { SourceRow } from "../schema";

/** Other games whose events come only from pasted articles: each has its own rules, articles, overview and monthly summary. */
export function GameSources({ sources, channelOptions, channelsReady }: { sources: SourceRow[]; channelOptions: SelectOption[]; channelsReady: boolean }) {
  const t = useTranslations("Events.games");
  const te = useTranslations("Events.errors");
  const ta = useTranslations("Events.article");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ source: SourceRow | null } | null>(null);
  const [removing, setRemoving] = useState<SourceRow | null>(null);
  const [texts, setTexts] = useState<Record<string, string>>({});

  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("never"));

  function run(job: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    startTransition(async () => {
      const result = await job();
      if (result.ok) toast.success(done);
      else toast.error(te(result.error as never));
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
                  </div>
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

type SourceValues = { name: string; enabled: boolean; overviewChannelId: string; overviewDays: number; summaryChannelId: string };

function SourceForm({ source, channelOptions, onDone }: { source: SourceRow | null; channelOptions: SelectOption[]; onDone: () => void }) {
  const t = useTranslations("Events.games");
  const te = useTranslations("Events.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<SourceValues>({
    defaultValues: source ? { name: source.name, enabled: source.enabled, overviewChannelId: source.overviewChannelId, overviewDays: source.overviewDays, summaryChannelId: source.summaryChannelId } : { name: "", enabled: true, overviewChannelId: "", overviewDays: 30, summaryChannelId: "" },
  });
  const { errors } = form.formState;
  const none = (label: string): SelectOption[] => [{ value: "", label }, ...channelOptions];

  const submit = form.handleSubmit((values) => {
    const checked = eventSourceSchema.safeParse({ ...(source ? { id: source.id } : {}), ...values, overviewDays: Number(values.overviewDays) });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "name" || k === "overviewDays") form.setError(k, { type: "custom", message: issue.message });
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
          <Input id="gs-name" maxLength={40} placeholder="Hunt: Showdown" aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          <FieldDescription>{t("nameHelp")}</FieldDescription>
          {errors.name && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="gs-overview">{t("overviewChannel")}</FieldLabel>
          <FormSelect control={form.control} name="overviewChannelId" id="gs-overview" options={none(t("none"))} placeholder={t("none")} />
        </Field>
        <Field data-invalid={Boolean(errors.overviewDays) || undefined}>
          <FieldLabel htmlFor="gs-days">{t("overviewDays")}</FieldLabel>
          <Input id="gs-days" type="number" inputMode="numeric" min={MIN_OVERVIEW_DAYS} max={MAX_OVERVIEW_DAYS} className="max-w-[8rem]" {...form.register("overviewDays", { valueAsNumber: true })} />
          {errors.overviewDays && <FieldError>{te("badDays", { min: MIN_OVERVIEW_DAYS, max: MAX_OVERVIEW_DAYS })}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="gs-summary">{t("summaryChannel")}</FieldLabel>
          <FormSelect control={form.control} name="summaryChannelId" id="gs-summary" options={none(t("none"))} placeholder={t("none")} />
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
