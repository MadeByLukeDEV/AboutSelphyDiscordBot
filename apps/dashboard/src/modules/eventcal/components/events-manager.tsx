"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { EVENT_KINDS, eventRuleSchema, MAX_EVENT_RULES, MAX_RULE_TERMS } from "@aboutselphy/shared/eventcal";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { deleteEventRuleAction, repostEventAction, saveEventRuleAction } from "../actions";
import type { EventRuleRow, PostedEventRow, SourceRow } from "../schema";
import { SourcesManager } from "./sources-manager";

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

/** The games (sources) with their events, the posting rules, and the list of posted events. State flows in as props; changes call router.refresh(). */
export function EventsManager({ sources, rules, channels, roles, posted }: { sources: SourceRow[]; rules: EventRuleRow[]; channels: GuildChannel[] | null; roles: GuildRole[] | null; posted: PostedEventRow[] }) {
  const t = useTranslations("Events");
  const te = useTranslations("Events.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ rule: EventRuleRow | null } | null>(null);
  const [removing, setRemoving] = useState<EventRuleRow | null>(null);

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));
  const channelName = (id: string) => channels?.find((c) => c.id === id)?.name ?? id;

  function repost(id: string) {
    startTransition(async () => {
      const result = await repostEventAction({ id });
      if (result.ok) toast.success(t("posted.done"));
      else toast.error(result.error === "gone" ? t("posted.gone") : te(result.error));
      router.refresh();
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
      <SourcesManager sources={sources} channelOptions={channelOptions} roleOptions={(roles ?? []).map((r) => ({ value: r.id, label: r.name }))} channelsReady={channels !== null} />

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

      <section aria-labelledby="ev-rules" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="ev-rules" className="text-fluid-lg font-bold">
              {t("rules.title")} <span className="text-sm font-normal text-muted-foreground">{t("rules.count", { count: rules.length, max: MAX_EVENT_RULES })}</span>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t("rules.intro")}</p>
          </div>
          <Button size="sm" disabled={rules.length >= MAX_EVENT_RULES || channels === null || sources.length === 0} onClick={() => setEditing({ rule: null })}>
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
                    {r.sourceId && <Badge variant="outline">{sources.find((s) => s.id === r.sourceId)?.name ?? "?"}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[...r.kinds.map((k) => t(`games.kind.${k}` as never)), ...r.words, ...r.categories.map((c) => `#${c}`)].join(", ")} → #{channelName(r.channelId)}
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
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.rule ? t("rules.editTitle") : t("rules.newTitle")}</DialogTitle>
            <DialogDescription>{t("rules.formIntro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <RuleForm
              key={editing.rule?.id ?? "new"}
              rule={editing.rule}
              channelOptions={channelOptions}
              sources={sources}
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

type RuleValues = { sourceId: string; name: string; kinds: string[]; wordsText: string; categoriesText: string; channelId: string; pingRoleId: string; useCard: boolean; postSeries: boolean; useAi: boolean; enabled: boolean };

function RuleForm({ rule, channelOptions, sources, roles, onDone }: { rule: EventRuleRow | null; channelOptions: SelectOption[]; sources: SourceRow[]; roles: GuildRole[] | null; onDone: () => void }) {
  const t = useTranslations("Events.ruleForm");
  const te = useTranslations("Events.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<RuleValues>({
    defaultValues: rule
      ? { sourceId: rule.sourceId, name: rule.name, kinds: rule.kinds, wordsText: rule.words.join("\n"), categoriesText: rule.categories.join("\n"), channelId: rule.channelId, pingRoleId: rule.pingRoleId, useCard: rule.useCard, postSeries: rule.postSeries, useAi: rule.useAi, enabled: rule.enabled }
      : { sourceId: sources[0]?.id ?? "", name: "", kinds: [], wordsText: "", categoriesText: "", channelId: "", pingRoleId: "", useCard: false, postSeries: false, useAi: true, enabled: true },
  });
  const { errors } = form.formState;
  const sourceOptions: SelectOption[] = sources.map((s) => ({ value: s.id, label: s.name }));
  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  if (rule?.pingRoleId && !roleOptions.some((o) => o.value === rule.pingRoleId)) roleOptions.push({ value: rule.pingRoleId, label: rule.pingRoleId });
  if (rule && !channelOptions.some((o) => o.value === rule.channelId)) channelOptions = [...channelOptions, { value: rule.channelId, label: rule.channelId }];

  const submit = form.handleSubmit((values) => {
    const checked = eventRuleSchema.safeParse({
      ...(rule ? { id: rule.id } : {}),
      sourceId: values.sourceId,
      name: values.name,
      kinds: values.kinds,
      words: parseTerms(values.wordsText),
      categories: parseTerms(values.categoriesText),
      channelId: values.channelId,
      pingRoleId: values.pingRoleId,
      useCard: values.useCard,
      postSeries: values.postSeries,
      useAi: values.useAi,
      enabled: values.enabled,
    });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "name" || k === "channelId" || k === "sourceId") form.setError(k, { type: "custom", message: issue.message });
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
        {(
          <Field data-invalid={Boolean(errors.sourceId) || undefined}>
            <FieldLabel htmlFor="er-source">{t("source")}</FieldLabel>
            <FormSelect control={form.control} name="sourceId" id="er-source" options={sourceOptions} placeholder={t("sourcePlaceholder")} invalid={Boolean(errors.sourceId)} />
            <FieldDescription>{t("sourceHelp")}</FieldDescription>
            {errors.sourceId && <FieldError>{te("needsSource")}</FieldError>}
          </Field>
        )}
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="er-name">{t("name")}</FieldLabel>
          <Input id="er-name" maxLength={60} aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          {errors.name && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel id="er-kinds-label">{t("kinds")}</FieldLabel>
          <Controller
            control={form.control}
            name="kinds"
            render={({ field }) => (
              <div role="group" aria-labelledby="er-kinds-label" className="flex flex-wrap gap-2">
                {EVENT_KINDS.map((k) => {
                  const on = field.value.includes(k);
                  return (
                    <Button key={k} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => field.onChange(on ? field.value.filter((x) => x !== k) : [...field.value, k])}>
                      {t(`kindName.${k}` as never)}
                    </Button>
                  );
                })}
              </div>
            )}
          />
          <FieldDescription>{t("kindsHelp")}</FieldDescription>
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
        <Field orientation="horizontal">
          <Controller control={form.control} name="postSeries" render={({ field }) => <Switch id="er-series" checked={field.value} onCheckedChange={field.onChange} aria-describedby="er-series-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="er-series">{t("postSeries")}</FieldLabel>
            <FieldDescription id="er-series-help">{t("postSeriesHelp")}</FieldDescription>
          </div>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="useCard" render={({ field }) => <Switch id="er-card" checked={field.value} onCheckedChange={field.onChange} aria-describedby="er-card-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="er-card">{t("useCard")}</FieldLabel>
            <FieldDescription id="er-card-help">{t("useCardHelp")}</FieldDescription>
          </div>
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
