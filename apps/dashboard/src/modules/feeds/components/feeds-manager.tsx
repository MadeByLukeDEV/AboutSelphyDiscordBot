"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { MAX_FILTER_WORDS, parseWordList, DEFAULT_FEED_TEMPLATE, DEFAULT_INTERVAL_MINUTES, feedInput, MAX_FEED_TEMPLATE, MAX_FEED_URL, MAX_FEEDS, MAX_INTERVAL_MINUTES, MIN_INTERVAL_MINUTES } from "@aboutselphy/shared/feeds";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { checkFeedAction, removeFeedAction, saveFeedAction } from "../actions";
import type { FeedRow } from "../schema";
import { EmoteInsert } from "@/components/form/emote-insert";

type FormValues = { name: string; url: string; channelId: string; pingRoleId: string; messageTemplate: string; intervalMinutes: number; includeText: string; excludeText: string; useEmbed: boolean; filterDescription: boolean; digest: boolean; enabled: boolean };

/** The feeds with add, edit, check now and remove. State flows in as props; changes call router.refresh(). */
export function FeedsManager({ feeds, channels, roles, ready }: { feeds: FeedRow[]; channels: GuildChannel[] | null; roles: GuildRole[] | null; ready: boolean }) {
  const t = useTranslations("Feeds");
  const te = useTranslations("Feeds.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ row: FeedRow | null } | null>(null);

  const channelName = (id: string) => (channels?.find((c) => c.id === id) ? `#${channels.find((c) => c.id === id)!.name}` : id);
  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("never"));

  function remove(row: FeedRow) {
    startTransition(async () => {
      const result = await removeFeedAction(row.id);
      if (result.ok) {
        toast.success(t("removed"));
        router.refresh();
      } else toast.error(te(result.error));
    });
  }

  function check(row: FeedRow) {
    startTransition(async () => {
      const result = await checkFeedAction(row.id);
      if (!result.ok) toast.error(te(result.error));
      else if (result.status === "ok") toast.success(result.announced > 0 ? t("checkedAnnounced", { count: result.announced }) : row.baselined ? t("checkedNothing") : t("checkedBaseline"));
      else toast.error(t("checkedFailed", { status: result.status }));
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="fd-heading" className="flex flex-col gap-3">
      {!ready && <p className="surface p-4 text-sm text-destructive">{t("notReady")}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="fd-heading" className="text-fluid-lg font-bold">
          {t("list.title")} <span className="text-sm font-normal text-muted-foreground">{t("list.count", { count: feeds.length, max: MAX_FEEDS })}</span>
        </h2>
        <Button size="sm" disabled={!ready || feeds.length >= MAX_FEEDS || channels === null} onClick={() => setEditing({ row: null })}>
          <Plus aria-hidden />
          {t("add")}
        </Button>
      </div>
      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      {feeds.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {feeds.map((f) => (
            <li key={f.id} className="surface flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-[12rem] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{f.name}</span>
                  <Badge variant={f.enabled ? "default" : "secondary"}>{f.enabled ? t("on") : t("off")}</Badge>
                  {f.lastStatus && <Badge variant={f.lastStatus === "ok" ? "secondary" : "destructive"}>{f.lastStatus}</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {f.host} · {channelName(f.channelId)} · {t("list.every", { minutes: f.intervalMinutes })}
                </p>
                <p className="text-xs text-muted-foreground">{f.lastCheckedAt ? t("list.checked", { time: when(f.lastCheckedAt) }) : t("list.notChecked")}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={pending} onClick={() => check(f)}>
                  {t("checkNow")}
                </Button>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ row: f })}>
                  {t("edit")}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(f)}>
                  {t("remove")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.row ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <FeedForm
              key={editing.row?.id ?? "new"}
              row={editing.row}
              channels={channels}
              roles={roles}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function FeedForm({ row, channels, roles, onDone }: { row: FeedRow | null; channels: GuildChannel[] | null; roles: GuildRole[] | null; onDone: () => void }) {
  const t = useTranslations("Feeds.form");
  const te = useTranslations("Feeds.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    defaultValues: row
      ? { name: row.name, url: "", channelId: row.channelId, pingRoleId: row.pingRoleId ?? "", messageTemplate: row.messageTemplate, intervalMinutes: row.intervalMinutes, includeText: row.includeWords.join("\n"), excludeText: row.excludeWords.join("\n"), useEmbed: row.useEmbed, filterDescription: row.filterDescription, digest: row.digest, enabled: row.enabled }
      : { name: "", url: "", channelId: "", pingRoleId: "", messageTemplate: DEFAULT_FEED_TEMPLATE, intervalMinutes: DEFAULT_INTERVAL_MINUTES, includeText: "", excludeText: "", useEmbed: false, filterDescription: false, digest: false, enabled: true },
  });
  const { errors } = form.formState;

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));
  if (row && !channelOptions.some((o) => o.value === row.channelId)) channelOptions.push({ value: row.channelId, label: row.channelId });
  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];
  if (row?.pingRoleId && !roleOptions.some((o) => o.value === row.pingRoleId)) roleOptions.push({ value: row.pingRoleId, label: row.pingRoleId });

  const submit = form.handleSubmit((values) => {
    const { includeText, excludeText, ...rest } = values;
    const checked = feedInput.safeParse({ ...(row ? { id: row.id } : {}), ...rest, includeWords: parseWordList(includeText), excludeWords: parseWordList(excludeText) });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const k = issue.path[0];
        if (k === "name" || k === "url" || k === "channelId" || k === "messageTemplate" || k === "intervalMinutes") form.setError(k, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveFeedAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone();
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="fd-name">{t("name")}</FieldLabel>
          <Input id="fd-name" maxLength={60} aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          <FieldDescription>{t("nameHelp")}</FieldDescription>
          {errors.name && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.url) || undefined}>
          <FieldLabel htmlFor="fd-url">{t("url")}</FieldLabel>
          <Input id="fd-url" type="url" inputMode="url" autoComplete="off" maxLength={MAX_FEED_URL} placeholder={row ? t("urlKeep") : "https://"} aria-invalid={Boolean(errors.url) || undefined} {...form.register("url")} />
          <FieldDescription>{row ? t("urlEditHelp", { host: row.host }) : t("urlHelp")}</FieldDescription>
          {errors.url && <FieldError>{te("badUrl")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="fd-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="fd-channel" options={channelOptions} placeholder={t("channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="fd-role">{t("role")}</FieldLabel>
          <FormSelect control={form.control} name="pingRoleId" id="fd-role" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} />
          <FieldDescription>{t("roleHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.messageTemplate) || undefined}>
          <FieldLabel htmlFor="fd-template">{t("template")}</FieldLabel>
          <Textarea id="fd-template" rows={3} maxLength={MAX_FEED_TEMPLATE} aria-invalid={Boolean(errors.messageTemplate) || undefined} {...form.register("messageTemplate")} />
<EmoteInsert targetId="fd-template" />
          <FieldDescription>{t("templateHelp")}</FieldDescription>
          {errors.messageTemplate && <FieldError>{te("needsTemplate")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="fd-include">{t("include")}</FieldLabel>
          <Textarea id="fd-include" rows={2} {...form.register("includeText")} />
          <FieldDescription>{t("includeHelp", { max: MAX_FILTER_WORDS })}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="fd-exclude">{t("exclude")}</FieldLabel>
          <Textarea id="fd-exclude" rows={2} {...form.register("excludeText")} />
          <FieldDescription>{t("excludeHelp", { max: MAX_FILTER_WORDS })}</FieldDescription>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="digest" render={({ field }) => <Switch id="fd-digest" checked={field.value} onCheckedChange={field.onChange} aria-describedby="fd-digest-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="fd-digest">{t("digest")}</FieldLabel>
            <FieldDescription id="fd-digest-help">{t("digestHelp")}</FieldDescription>
          </div>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="filterDescription" render={({ field }) => <Switch id="fd-filter-desc" checked={field.value} onCheckedChange={field.onChange} aria-describedby="fd-filter-desc-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="fd-filter-desc">{t("filterDescription")}</FieldLabel>
            <FieldDescription id="fd-filter-desc-help">{t("filterDescriptionHelp")}</FieldDescription>
          </div>
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="useEmbed" render={({ field }) => <Switch id="fd-embed" checked={field.value} onCheckedChange={field.onChange} aria-describedby="fd-embed-help" />} />
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor="fd-embed">{t("embed")}</FieldLabel>
            <FieldDescription id="fd-embed-help">{t("embedHelp")}</FieldDescription>
          </div>
        </Field>
        <Field data-invalid={Boolean(errors.intervalMinutes) || undefined}>
          <FieldLabel htmlFor="fd-interval">{t("interval")}</FieldLabel>
          <Input id="fd-interval" type="number" inputMode="numeric" min={MIN_INTERVAL_MINUTES} max={MAX_INTERVAL_MINUTES} className="max-w-[8rem]" {...form.register("intervalMinutes", { valueAsNumber: true })} />
          <FieldDescription>{t("intervalHelp", { min: MIN_INTERVAL_MINUTES, max: MAX_INTERVAL_MINUTES })}</FieldDescription>
          {errors.intervalMinutes && <FieldError>{te("badInterval", { min: MIN_INTERVAL_MINUTES, max: MAX_INTERVAL_MINUTES })}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="fd-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="fd-enabled">{t("enabled")}</FieldLabel>
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
