"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { MIN_SCHEDULE_AHEAD_MS } from "@aboutselphy/shared/announcement";
import { MAX_OPTION, MAX_OPTIONS, MAX_QUESTION, MIN_OPTIONS, parseOptions, pollInput } from "@aboutselphy/shared/polls";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { createPollAction, deletePollAction, pollControlAction } from "../actions";
import type { PollView } from "../schema";

type FormValues = { channelId: string; question: string; optionsText: string; multiple: boolean; endsLocal: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const BAR: Record<PollView["status"], string> = { draft: "bg-muted-foreground/40", active: "bg-primary", ended: "bg-emerald-500" };

/** The polls as a list with live results, create, start, end now and delete. State flows in as props; changes call router.refresh(). */
export function PollsManager({ polls, channels }: { polls: PollView[]; channels: GuildChannel[] | null }) {
  const t = useTranslations("Polls");
  const te = useTranslations("Polls.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<{ poll: PollView; kind: "end" | "delete" } | null>(null);

  const channelName = (id: string) => (channels?.find((c) => c.id === id) ? `#${channels.find((c) => c.id === id)!.name}` : id);
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast.success(success);
        setConfirm(null);
        router.refresh();
      } else {
        toast.error(te(result.error as "failed"));
      }
    });
  }

  return (
    <section aria-labelledby="poll-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="poll-heading" className="text-fluid-lg font-bold">
          {t("list.title")}
        </h2>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      {polls.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {polls.map((p) => {
            const total = p.counts.reduce((a, b) => a + b, 0);
            return (
              <li key={p.id} className="surface flex overflow-hidden">
                <span className={cn("w-1.5 shrink-0", BAR[p.status])} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-[12rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words font-semibold">{p.question}</h3>
                      <Badge variant={p.status === "draft" ? "secondary" : "default"}>{t(`status.${p.status}`)}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {channelName(p.channelId)} · {p.multiple ? t("list.multiple") : t("list.single")}
                      {p.endsAt ? ` · ${p.status === "ended" ? t("list.ended", { time: when(p.endsAt) }) : t("list.ends", { time: when(p.endsAt) })}` : ""} · {t("list.by", { name: p.createdByName })}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {p.options.map((option, i) => {
                        const count = p.counts[i] ?? 0;
                        const percent = total === 0 ? 0 : Math.round((count / total) * 100);
                        return (
                          <li key={i} className="text-sm">
                            <div className="flex justify-between gap-3">
                              <span className="min-w-0 break-words">{option}</span>
                              <span className="shrink-0 tabular-nums text-muted-foreground">
                                {count} ({percent}%)
                              </span>
                            </div>
                            <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-muted" role="presentation">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-1 text-xs text-muted-foreground">{t("list.voters", { count: p.voters })}</p>
                  </div>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {p.status === "draft" && (
                      <Button size="sm" disabled={pending} onClick={() => run(() => pollControlAction(p.id, "start"), t("started"))}>
                        {t("actions.start")}
                      </Button>
                    )}
                    {p.status === "active" && (
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm({ poll: p, kind: "end" })}>
                        {t("actions.end")}
                      </Button>
                    )}
                    {p.status !== "active" && (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ poll: p, kind: "delete" })}>
                        {t("actions.delete")}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("dialog.title")}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {creating && (
            <PollForm
              channels={channels}
              onDone={() => {
                setCreating(false);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm ? t(`confirm.${confirm.kind}.title`) : ""}</DialogTitle>
            <DialogDescription>{confirm ? t(`confirm.${confirm.kind}.body`, { question: confirm.poll.question }) : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("confirm.back")}</DialogClose>
            <Button
              variant={confirm?.kind === "end" ? "default" : "destructive"}
              disabled={pending}
              onClick={() => {
                if (!confirm) return;
                const id = confirm.poll.id;
                if (confirm.kind === "delete") run(() => deletePollAction(id), t("deleted"));
                else run(() => pollControlAction(id, "end"), t("ended"));
              }}
            >
              {confirm ? t(`confirm.${confirm.kind}.button`) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function PollForm({ channels, onDone }: { channels: GuildChannel[] | null; onDone: () => void }) {
  const t = useTranslations("Polls.form");
  const te = useTranslations("Polls.errors");
  const [pending, startTransition] = useTransition();
  // The earliest end that can be chosen, computed once when the form opens.
  const [minLocal] = useState(() => toLocalInput(new Date(Date.now() + MIN_SCHEDULE_AHEAD_MS)));
  const form = useForm<FormValues>({ defaultValues: { channelId: "", question: "", optionsText: "", multiple: false, endsLocal: "" } });
  const { errors } = form.formState;

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));

  const submit = (start: boolean) =>
    form.handleSubmit((values) => {
      const ends = values.endsLocal ? new Date(values.endsLocal) : null;
      const checked = pollInput.safeParse({
        channelId: values.channelId,
        question: values.question,
        options: parseOptions(values.optionsText),
        multiple: values.multiple,
        endsAt: ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : "",
      });
      if (!checked.success) {
        form.clearErrors();
        for (const issue of checked.error.issues) {
          const key = issue.path[0];
          if (key === "endsAt") form.setError("endsLocal", { type: "custom", message: issue.message });
          else if (key === "options") form.setError("optionsText", { type: "custom", message: issue.message });
          else if (key === "channelId" || key === "question") form.setError(key, { type: "custom", message: issue.message });
        }
        return;
      }
      startTransition(async () => {
        const result = await createPollAction(checked.data, start);
        if (!result.ok) return void toast.error(te(result.error));
        if (result.startError) toast.error(te(`start.${result.startError}` as "failed"));
        else toast.success(result.started ? t("started") : t("saved"));
        onDone();
      });
    });

  const endError = errors.endsLocal?.message;

  return (
    <form onSubmit={(e) => void submit(false)(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.question) || undefined}>
          <FieldLabel htmlFor="poll-question">{t("question")}</FieldLabel>
          <Input id="poll-question" maxLength={MAX_QUESTION} aria-invalid={Boolean(errors.question) || undefined} {...form.register("question")} />
          {errors.question && <FieldError>{te("needsQuestion")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.optionsText) || undefined}>
          <FieldLabel htmlFor="poll-options">{t("options")}</FieldLabel>
          <Textarea id="poll-options" rows={5} aria-invalid={Boolean(errors.optionsText) || undefined} placeholder={t("optionsPlaceholder")} {...form.register("optionsText")} />
          <FieldDescription>{t("optionsHelp", { min: MIN_OPTIONS, max: MAX_OPTIONS, length: MAX_OPTION })}</FieldDescription>
          {errors.optionsText && <FieldError>{te("badOptions", { min: MIN_OPTIONS, max: MAX_OPTIONS, length: MAX_OPTION })}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="poll-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="poll-channel" options={channelOptions} placeholder={t("channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(endError) || undefined}>
          <FieldLabel htmlFor="poll-ends">{t("ends")}</FieldLabel>
          <Input id="poll-ends" type="datetime-local" min={minLocal} aria-invalid={Boolean(endError) || undefined} {...form.register("endsLocal")} />
          <FieldDescription>{t("endsHelp")}</FieldDescription>
          {endError && <FieldError>{te(endError === "past" ? "endPast" : endError === "tooFar" ? "endTooFar" : "endTime")}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <input id="poll-multiple" type="checkbox" className="size-4 accent-[var(--color-primary)]" {...form.register("multiple")} />
          <FieldLabel htmlFor="poll-multiple">{t("multiple")}</FieldLabel>
        </Field>
      </FieldGroup>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
        <Button type="button" variant="outline" disabled={pending} onClick={() => void submit(false)()}>
          {t("saveDraft")}
        </Button>
        <Button type="button" disabled={pending} onClick={() => void submit(true)()}>
          {pending ? t("saving") : t("start")}
        </Button>
      </DialogFooter>
    </form>
  );
}
