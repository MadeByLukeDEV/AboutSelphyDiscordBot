"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { LayoutList, Plus, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { eventRuleSchema, eventSettingsSchema, MAX_DAYS_AHEAD, MAX_EVENT_RULES, MAX_OVERVIEW_DAYS, MAX_RULE_TERMS, MIN_OVERVIEW_DAYS, type EventSettings } from "@aboutselphy/shared/eventcal";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { checkEventCalendarAction, deleteEventArticleAction, deleteEventRuleAction, importEventArticleAction, repostEventAction, postEventOverviewAction, saveEventRuleAction, saveEventSettingsAction } from "../actions";
import type { ArticleRow, EventOverview, EventRuleRow, PostedEventRow } from "../schema";

/** One term per line (or separated by commas) -> clean list, no duplicates. */
const parseTerms = (text: string): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[\n,]+/)) {
    const term = raw.trim().replace(/\s+/g, " ");
    if (term && !seen.has(term.toLowerCase())) {
      seen.add(term.toLowerCase());
      out.push(term);
    }
  }
  return out;
};

/** The calendar settings, the posting rules, and the overview message. State flows in as props; changes call router.refresh(). */
export function EventsManager({ overview, rules, channels, roles, articles, posted }: { overview: EventOverview; rules: EventRuleRow[]; channels: GuildChannel[] | null; roles: GuildRole[] | null; articles: ArticleRow[]; posted: PostedEventRow[] }) {
  const t = useTranslations("Events");
  const te = useTranslations("Events.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ rule: EventRuleRow | null } | null>(null);
  const [removing, setRemoving] = useState<EventRuleRow | null>(null);
  const [articleText, setArticleText] = useState("");

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));
  const channelName = (id: string) => channels?.find((c) => c.id === id)?.name ?? id;

  const form = useForm<EventSettings>({ defaultValues: overview.settings });
  const { errors, isDirty } = form.formState;
  const overviewChannelOptions: SelectOption[] = [{ value: "", label: t("settings.noOverview") }, ...channelOptions];
  if (overview.settings.overviewChannelId && !overviewChannelOptions.some((o) => o.value === overview.settings.overviewChannelId)) overviewChannelOptions.push({ value: overview.settings.overviewChannelId, label: overview.settings.overviewChannelId });

  const save = form.handleSubmit((raw) => {
    const checked = eventSettingsSchema.safeParse({ ...raw, overviewDays: Number(raw.overviewDays) });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "icsUrl" || k === "overviewDays") form.setError(k, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveEventSettingsAction(checked.data);
      if (result.ok) {
        toast.success(result.botNotified ? t("settings.saved") : t("settings.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  function check() {
    startTransition(async () => {
      const result = await checkEventCalendarAction();
      if (result.ok) toast.success(t("checked", { status: result.status, events: result.events, posted: result.posted, edited: result.edited }));
      else toast.error(te(result.error));
      router.refresh();
    });
  }

  function overviewNow() {
    startTransition(async () => {
      const result = await postEventOverviewAction();
      if (result.ok) toast.success(result.status === "posted" ? t("overview.posted") : t("overview.updated"));
      else toast.error(te(result.error));
      router.refresh();
    });
  }

  function importArticle() {
    startTransition(async () => {
      const result = await importEventArticleAction({ text: articleText });
      if (result.ok) {
        toast.success(t("article.done", { dated: result.dated, repeating: result.repeating, month: result.month }));
        setArticleText("");
        router.refresh();
      } else {
        toast.error(result.error === "unreadable" ? t("article.unreadable") : result.error === "tooLong" ? t("article.tooLong") : te(result.error));
      }
    });
  }

  function repost(id: string) {
    startTransition(async () => {
      const result = await repostEventAction({ id });
      if (result.ok) toast.success(t("posted.done"));
      else toast.error(result.error === "gone" ? t("posted.gone") : te(result.error));
      router.refresh();
    });
  }

  function removeArticle(id: string) {
    startTransition(async () => {
      const result = await deleteEventArticleAction({ id });
      if (result.ok) router.refresh();
      else toast.error(te(result.error));
    });
  }

  function confirmRemove() {
    const target = removing;
    if (!target) return;
    startTransition(async () => {
      const result = await deleteEventRuleAction({ id: target.id });
      if (result.ok) {
        toast.success(t("rules.removed"));
        setRemoving(null);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("never"));

  return (
    <div className="flex flex-col gap-fluid">
      <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
        <h2 className="text-fluid-lg font-bold">{t("settings.title")}</h2>
        <FieldGroup>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="ev-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="ev-enabled">{t("settings.enabled")}</FieldLabel>
          </Field>
          <Field data-invalid={Boolean(errors.icsUrl) || undefined}>
            <FieldLabel htmlFor="ev-url">{t("settings.url")}</FieldLabel>
            <Input id="ev-url" type="url" autoComplete="off" maxLength={500} aria-invalid={Boolean(errors.icsUrl) || undefined} {...form.register("icsUrl")} />
            <FieldDescription>{t("settings.urlHelp")}</FieldDescription>
            {errors.icsUrl && <FieldError>{te("badUrl")}</FieldError>}
          </Field>
          <Field>
            <FieldLabel htmlFor="ev-overview-channel">{t("settings.overviewChannel")}</FieldLabel>
            <FormSelect control={form.control} name="overviewChannelId" id="ev-overview-channel" options={overviewChannelOptions} placeholder={t("settings.noOverview")} disabled={channels === null} />
            <FieldDescription>{t("settings.overviewHelp")}</FieldDescription>
          </Field>
          <Field data-invalid={Boolean(errors.overviewDays) || undefined}>
            <FieldLabel htmlFor="ev-days">{t("settings.overviewDays")}</FieldLabel>
            <Input id="ev-days" type="number" inputMode="numeric" min={MIN_OVERVIEW_DAYS} max={MAX_OVERVIEW_DAYS} className="max-w-[8rem]" {...form.register("overviewDays", { valueAsNumber: true })} />
            {errors.overviewDays && <FieldError>{te("badDays", { min: MIN_OVERVIEW_DAYS, max: MAX_OVERVIEW_DAYS })}</FieldError>}
          </Field>
        </FieldGroup>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("settings.saving") : t("settings.save")}
          </Button>
          <Button type="button" variant="outline" disabled={pending || isDirty} onClick={check}>
            <RefreshCw aria-hidden />
            {t("checkNow")}
          </Button>
          <Button type="button" variant="outline" disabled={pending || isDirty || !overview.settings.overviewChannelId} onClick={overviewNow}>
            <LayoutList aria-hidden />
            {overview.hasOverview ? t("overview.update") : t("overview.post")}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("status", { time: when(overview.lastCheckedAt), status: overview.lastStatus ?? "-" })} {!overview.baselined && overview.lastCheckedAt === null ? t("firstCheck") : ""}
        </p>
      </form>

      {posted.length > 0 && (
        <section aria-labelledby="ev-posted" className="surface flex flex-col gap-3 p-5">
          <div className="flex flex-col gap-1">
            <h2 id="ev-posted" className="text-fluid-lg font-bold">
              {t("posted.title")}
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t("posted.intro")}</p>
          </div>
          <ul className="flex flex-col divide-y text-sm">
            {posted.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate font-medium">{p.title}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {p.rule} · {when(p.startsAt)}
                  <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => repost(p.id)}>
                    <RotateCcw aria-hidden />
                    {t("posted.repost")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="ev-article" className="surface flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 id="ev-article" className="text-fluid-lg font-bold">
            {t("article.title")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("article.intro")}</p>
        </div>
        <Field>
          <FieldLabel htmlFor="ev-article-text">{t("article.label")}</FieldLabel>
          <Textarea id="ev-article-text" rows={8} className="font-mono text-xs" value={articleText} onChange={(e) => setArticleText(e.target.value)} placeholder={t("article.placeholder")} />
          <FieldDescription>{t("article.help")}</FieldDescription>
        </Field>
        <div>
          <Button type="button" disabled={pending || articleText.trim() === ""} onClick={importArticle}>
            {t("article.import")}
          </Button>
        </div>
        {articles.length > 0 && (
          <ul className="flex flex-col divide-y text-sm">
            {articles.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate font-medium">{a.title}</span>
                <span className="flex items-center gap-2 text-muted-foreground">
                  {t("article.row", { month: a.monthKey, events: a.events })}
                  <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => removeArticle(a.id)}>
                    {t("remove")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ev-rules" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="ev-rules" className="text-fluid-lg font-bold">
              {t("rules.title")} <span className="text-sm font-normal text-muted-foreground">{t("rules.count", { count: rules.length, max: MAX_EVENT_RULES })}</span>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t("rules.intro")}</p>
          </div>
          <Button size="sm" disabled={rules.length >= MAX_EVENT_RULES || channels === null} onClick={() => setEditing({ rule: null })}>
            <Plus aria-hidden />
            {t("rules.add")}
          </Button>
        </div>
        {rules.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">{t("rules.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rules.map((r) => (
              <li key={r.id} className="surface flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{r.name}</span>
                    <Badge variant={r.enabled ? "default" : "secondary"}>{r.enabled ? t("on") : t("off")}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[...r.words, ...r.categories.map((c) => `#${c}`)].join(", ")} → #{channelName(r.channelId)} · {t("rules.ahead", { days: r.daysAhead })}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ rule: r })}>
                    {t("edit")}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRemoving(r)}>
                    {t("remove")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.rule ? t("rules.editTitle") : t("rules.newTitle")}</DialogTitle>
            <DialogDescription>{t("rules.formIntro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <RuleForm
              key={editing.rule?.id ?? "new"}
              rule={editing.rule}
              channelOptions={channelOptions}
              roles={roles}
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
            <DialogTitle>{t("rules.removeTitle")}</DialogTitle>
            <DialogDescription>{t("rules.removeBody", { name: removing?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("cancel")}</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={confirmRemove}>
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type RuleValues = { name: string; wordsText: string; categoriesText: string; channelId: string; pingRoleId: string; daysAhead: number; useAi: boolean; enabled: boolean };

function RuleForm({ rule, channelOptions, roles, onDone }: { rule: EventRuleRow | null; channelOptions: SelectOption[]; roles: GuildRole[] | null; onDone: () => void }) {
  const t = useTranslations("Events.ruleForm");
  const te = useTranslations("Events.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<RuleValues>({
    defaultValues: rule
      ? { name: rule.name, wordsText: rule.words.join("\n"), categoriesText: rule.categories.join("\n"), channelId: rule.channelId, pingRoleId: rule.pingRoleId, daysAhead: rule.daysAhead, useAi: rule.useAi, enabled: rule.enabled }
      : { name: "", wordsText: "", categoriesText: "", channelId: "", pingRoleId: "", daysAhead: 7, useAi: true, enabled: true },
  });
  const { errors } = form.formState;
  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  if (rule?.pingRoleId && !roleOptions.some((o) => o.value === rule.pingRoleId)) roleOptions.push({ value: rule.pingRoleId, label: rule.pingRoleId });
  if (rule && !channelOptions.some((o) => o.value === rule.channelId)) channelOptions = [...channelOptions, { value: rule.channelId, label: rule.channelId }];

  const submit = form.handleSubmit((values) => {
    const checked = eventRuleSchema.safeParse({
      ...(rule ? { id: rule.id } : {}),
      name: values.name,
      words: parseTerms(values.wordsText),
      categories: parseTerms(values.categoriesText),
      channelId: values.channelId,
      pingRoleId: values.pingRoleId,
      daysAhead: Number(values.daysAhead),
      useAi: values.useAi,
      enabled: values.enabled,
    });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "name" || k === "channelId" || k === "daysAhead") form.setError(k, { type: "custom", message: issue.message });
        else if (k === "words" || k === "categories") form.setError("wordsText", { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveEventRuleAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="er-name">{t("name")}</FieldLabel>
          <Input id="er-name" maxLength={60} aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          {errors.name && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.wordsText) || undefined}>
          <FieldLabel htmlFor="er-words">{t("words")}</FieldLabel>
          <Textarea id="er-words" rows={3} placeholder={t("wordsPlaceholder")} {...form.register("wordsText")} />
          <FieldDescription>{t("wordsHelp", { max: MAX_RULE_TERMS })}</FieldDescription>
          {errors.wordsText && <FieldError>{te("needsMatch")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="er-categories">{t("categories")}</FieldLabel>
          <Textarea id="er-categories" rows={2} placeholder="twitch_drop" {...form.register("categoriesText")} />
          <FieldDescription>{t("categoriesHelp", { max: MAX_RULE_TERMS })}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="er-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="er-channel" options={channelOptions} placeholder={t("channelPlaceholder")} invalid={Boolean(errors.channelId)} />
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="er-role">{t("role")}</FieldLabel>
          <FormSelect control={form.control} name="pingRoleId" id="er-role" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} />
          <FieldDescription>{t("roleHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.daysAhead) || undefined}>
          <FieldLabel htmlFor="er-days">{t("daysAhead")}</FieldLabel>
          <Input id="er-days" type="number" inputMode="numeric" min={0} max={MAX_DAYS_AHEAD} className="max-w-[8rem]" {...form.register("daysAhead", { valueAsNumber: true })} />
          <FieldDescription>{t("daysAheadHelp", { max: MAX_DAYS_AHEAD })}</FieldDescription>
          {errors.daysAhead && <FieldError>{te("badDaysAhead", { max: MAX_DAYS_AHEAD })}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="useAi" render={({ field }) => <Switch id="er-ai" checked={field.value} onCheckedChange={field.onChange} aria-describedby="er-ai-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="er-ai">{t("useAi")}</FieldLabel>
            <FieldDescription id="er-ai-help">{t("useAiHelp")}</FieldDescription>
          </div>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="er-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="er-enabled">{t("enabled")}</FieldLabel>
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
