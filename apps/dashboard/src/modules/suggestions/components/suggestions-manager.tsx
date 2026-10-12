"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { canTransition, MAX_DECISION_REASON, SUGGESTION_STATUSES, suggestionSettingsSchema, type Decision, type SuggestionSettings, type SuggestionStatusName } from "@aboutselphy/shared/suggestions";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { decideSuggestionAction, saveSuggestionSettingsAction } from "../actions";
import type { SuggestionRow } from "../schema";
import { EmoteInsert } from "@/components/form/emote-insert";

const BAR: Record<SuggestionStatusName, string> = { open: "bg-sky-500", approved: "bg-emerald-500", denied: "bg-rose-500", implemented: "bg-primary" };

/** The suggestions for staff (read and decide), and for admins the settings. */
export function SuggestionsManager({
  initial,
  suggestions,
  perStatus,
  filter,
  channels,
  canEdit,
}: {
  initial: SuggestionSettings;
  suggestions: SuggestionRow[];
  perStatus: Record<SuggestionStatusName, number>;
  filter: SuggestionStatusName | null;
  channels: GuildChannel[] | null;
  canEdit: boolean;
}) {
  const t = useTranslations("Suggestions");
  const te = useTranslations("Suggestions.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deciding, setDeciding] = useState<{ row: SuggestionRow; status: Decision } | null>(null);
  const [reason, setReason] = useState("");

  const form = useForm<SuggestionSettings>({ resolver: zodResolver(suggestionSettingsSchema), defaultValues: initial });
  const { errors, isDirty } = form.formState;
  const channelOptions: SelectOption[] = [
    { value: "", label: t("noChannel") },
    ...(channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (initial.channelId && !channelOptions.some((o) => o.value === initial.channelId)) channelOptions.push({ value: initial.channelId, label: initial.channelId });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await saveSuggestionSettingsAction(values);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  function confirmDecision() {
    const target = deciding;
    if (!target) return;
    startTransition(async () => {
      const result = await decideSuggestionAction({ id: target.row.id, status: target.status, reason: reason.trim() });
      if (result.ok) {
        toast.success(t("decided"));
        setDeciding(null);
        setReason("");
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });
  const actionsFor = (row: SuggestionRow): Decision[] => (["approved", "denied", "implemented"] as const).filter((d) => canTransition(row.status, d));

  return (
    <div className="flex flex-col gap-fluid">
      {canEdit && (
        <form onSubmit={onSubmit} className="surface flex flex-col gap-5 p-5" noValidate>
          <div className="flex flex-col gap-1">
            <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
          </div>
          <FieldGroup>
            <Field orientation="horizontal">
              <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="sg-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
              <FieldLabel htmlFor="sg-enabled">{t("form.enabled")}</FieldLabel>
            </Field>
            <Field data-invalid={Boolean(errors.channelId) || undefined}>
              <FieldLabel htmlFor="sg-channel">{t("form.channel")}</FieldLabel>
              <FormSelect control={form.control} name="channelId" id="sg-channel" options={channelOptions} placeholder={t("form.channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
              <FieldDescription>{channels === null ? t("form.botOffline") : t("form.channelHelp")}</FieldDescription>
              {errors.channelId && <FieldError>{te("needsChannel")}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="sg-cooldown">{t("form.cooldown")}</FieldLabel>
              <Input id="sg-cooldown" type="number" inputMode="numeric" min={0} max={3600} className="max-w-[8rem]" {...form.register("cooldownSeconds", { valueAsNumber: true })} />
              <FieldDescription>{t("form.cooldownHelp")}</FieldDescription>
            </Field>
          </FieldGroup>
          <div>
            <Button type="submit" disabled={pending || !isDirty}>
              {pending ? t("form.saving") : t("form.save")}
            </Button>
          </div>
        </form>
      )}

      <section aria-labelledby="sg-list" className="flex flex-col gap-3">
        <h2 id="sg-list" className="text-fluid-lg font-bold">
          {t("list.title")}
        </h2>
        <nav aria-label={t("list.filter")} className="flex flex-wrap gap-2">
          <Link href="/suggestions" className={cn("rounded-full border px-3 py-1 text-sm", filter === null ? "bg-primary/15" : "hover:bg-accent")}>
            {t("list.all")}
          </Link>
          {SUGGESTION_STATUSES.map((s) => (
            <Link key={s} href={`/suggestions?status=${s}`} className={cn("rounded-full border px-3 py-1 text-sm", filter === s ? "bg-primary/15" : "hover:bg-accent")}>
              {t(`status.${s}`)} <span className="text-muted-foreground tabular-nums">{perStatus[s]}</span>
            </Link>
          ))}
        </nav>

        {suggestions.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-8 text-center">
            <h3 className="font-semibold">{t("list.empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("list.empty.body")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li key={s.id} className="surface flex overflow-hidden">
                <span className={cn("w-1.5 shrink-0", BAR[s.status])} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold tabular-nums">#{s.number}</span>
                    <Badge variant={s.status === "open" ? "secondary" : "default"}>{t(`status.${s.status}`)}</Badge>
                    <span className="text-sm text-muted-foreground">{s.authorName || s.authorId} · {when(s.createdAt)}</span>
                    <span className="ml-auto text-sm tabular-nums">👍 {s.up} · 👎 {s.down}</span>
                  </div>
                  {/* Plain text: React escapes it, so nothing a member typed can become markup or a link. */}
                  <p className="text-sm break-words whitespace-pre-wrap">{s.content}</p>
                  {s.status !== "open" && (
                    <p className="text-sm text-muted-foreground">
                      {t("list.decidedBy", { name: s.decidedByName ?? t("list.team") })}
                      {s.decisionReason ? `: ${s.decisionReason}` : ""}
                    </p>
                  )}
                  {actionsFor(s).length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {actionsFor(s).map((d) => (
                        <Button key={d} size="sm" variant={d === "denied" ? "outline" : "default"} disabled={pending} onClick={() => { setReason(""); setDeciding({ row: s, status: d }); }}>
                          {t(`actions.${d}`)}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={deciding !== null} onOpenChange={(open) => !open && setDeciding(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deciding ? t(`dialog.${deciding.status}`, { number: deciding.row.number }) : ""}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="sg-reason">{t("dialog.reason")}</FieldLabel>
            <Textarea id="sg-reason" rows={3} maxLength={MAX_DECISION_REASON} value={reason} onChange={(e) => setReason(e.target.value)} />
<EmoteInsert targetId="sg-reason" />
            <FieldDescription>{t("dialog.reasonHelp", { count: reason.length, max: MAX_DECISION_REASON })}</FieldDescription>
          </Field>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("dialog.cancel")}</DialogClose>
            <Button disabled={pending} onClick={confirmDecision}>
              {pending ? t("form.saving") : t("dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
