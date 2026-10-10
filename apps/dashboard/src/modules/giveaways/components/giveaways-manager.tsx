"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { MIN_SCHEDULE_AHEAD_MS } from "@aboutselphy/shared/announcement";
import { giveawayInput, MAX_GIVEAWAY_DESCRIPTION, MAX_PRIZE, MAX_WINNERS } from "@aboutselphy/shared/giveaways";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { deleteGiveawayAction, giveawayControlAction, saveGiveawayAction } from "../actions";
import type { GiveawayView } from "../schema";

type FormValues = {
  channelId: string;
  prize: string;
  description: string;
  winnerCount: number;
  endsLocal: string;
  requiredRoleId: string;
  pingRoleId: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

const BAR: Record<GiveawayView["status"], string> = { draft: "bg-muted-foreground/40", active: "bg-primary", ended: "bg-emerald-500", cancelled: "bg-destructive/60" };

/** The giveaways as a list with create, start, end now, re-roll, cancel and delete. State flows in as props; changes call router.refresh(). */
export function GiveawaysManager({ giveaways, channels, roles }: { giveaways: GiveawayView[]; channels: GuildChannel[] | null; roles: GuildRole[] | null }) {
  const t = useTranslations("Giveaways");
  const te = useTranslations("Giveaways.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ giveaway: GiveawayView | null } | null>(null);
  const [confirm, setConfirm] = useState<{ giveaway: GiveawayView; kind: "end" | "cancel" | "delete" } | null>(null);

  const channelName = (id: string) => channels?.find((c) => c.id === id)?.name ? `#${channels.find((c) => c.id === id)!.name}` : id;
  const roleName = (id: string) => roles?.find((r) => r.id === id)?.name ?? id;
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
    <section aria-labelledby="gw-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="gw-heading" className="text-fluid-lg font-bold">
          {t("list.title")}
        </h2>
        <Button size="sm" onClick={() => setEditing({ giveaway: null })}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      {giveaways.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {giveaways.map((g) => (
            <li key={g.id} className="surface flex overflow-hidden">
              <span className={cn("w-1.5 shrink-0", BAR[g.status])} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 truncate font-semibold">🎉 {g.prize}</h3>
                    <Badge variant={g.status === "active" ? "default" : g.status === "ended" ? "default" : "secondary"}>{t(`status.${g.status}`)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {channelName(g.channelId)} · {g.status === "ended" ? t("list.ended", { time: when(g.endsAt) }) : t("list.ends", { time: when(g.endsAt) })} · {t("list.winners", { count: g.winnerCount })}
                    {g.requiredRoleId ? ` · ${t("list.needs", { role: roleName(g.requiredRoleId) })}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("list.entries", { count: g.entryCount })} · {t("list.by", { name: g.hostName })}</p>
                  {g.status === "ended" && <p className="text-sm">{g.winners.length ? t("list.wonBy", { count: g.winners.length }) : t("list.noWinners")}</p>}
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  {g.status === "draft" && (
                    <>
                      <Button size="sm" disabled={pending} onClick={() => run(async () => {
                        const r = await saveGiveawayAction({ id: g.id, channelId: g.channelId, prize: g.prize, description: g.description, winnerCount: g.winnerCount, endsAt: g.endsAt, requiredRoleId: g.requiredRoleId, pingRoleId: g.pingRoleId, start: true });
                        return r.ok ? (r.startError ? { ok: false as const, error: r.startError } : { ok: true as const }) : r;
                      }, t("started"))}>
                        {t("actions.start")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ giveaway: g })}>
                        {t("actions.edit")}
                      </Button>
                    </>
                  )}
                  {g.status === "active" && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm({ giveaway: g, kind: "end" })}>
                      {t("actions.end")}
                    </Button>
                  )}
                  {g.status === "ended" && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => giveawayControlAction(g.id, "reroll"), t("rerolled"))}>
                      {t("actions.reroll")}
                    </Button>
                  )}
                  {(g.status === "draft" || g.status === "active") && (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ giveaway: g, kind: "cancel" })}>
                      {t("actions.cancel")}
                    </Button>
                  )}
                  {g.status !== "active" && (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ giveaway: g, kind: "delete" })}>
                      {t("actions.delete")}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.giveaway ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <GiveawayForm
              key={editing.giveaway?.id ?? "new"}
              giveaway={editing.giveaway}
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

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm ? t(`confirm.${confirm.kind}.title`) : ""}</DialogTitle>
            <DialogDescription>{confirm ? t(`confirm.${confirm.kind}.body`, { prize: confirm.giveaway.prize }) : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("confirm.back")}</DialogClose>
            <Button
              variant={confirm?.kind === "end" ? "default" : "destructive"}
              disabled={pending}
              onClick={() => {
                if (!confirm) return;
                const id = confirm.giveaway.id;
                if (confirm.kind === "delete") run(() => deleteGiveawayAction(id), t("deleted"));
                else run(() => giveawayControlAction(id, confirm.kind), confirm.kind === "end" ? t("ended") : t("cancelled"));
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

function GiveawayForm({ giveaway, channels, roles, onDone }: { giveaway: GiveawayView | null; channels: GuildChannel[] | null; roles: GuildRole[] | null; onDone: () => void }) {
  const t = useTranslations("Giveaways.form");
  const te = useTranslations("Giveaways.errors");
  const [pending, startTransition] = useTransition();
  // The earliest end that can be chosen, computed once when the form opens.
  const [minLocal] = useState(() => toLocalInput(new Date(Date.now() + MIN_SCHEDULE_AHEAD_MS)));
  const form = useForm<FormValues>({
    defaultValues: giveaway
      ? { channelId: giveaway.channelId, prize: giveaway.prize, description: giveaway.description, winnerCount: giveaway.winnerCount, endsLocal: toLocalInput(new Date(giveaway.endsAt)), requiredRoleId: giveaway.requiredRoleId, pingRoleId: giveaway.pingRoleId }
      : { channelId: "", prize: "", description: "", winnerCount: 1, endsLocal: "", requiredRoleId: "", pingRoleId: "" },
  });
  const { errors } = form.formState;
  const [description] = useWatch({ control: form.control, name: ["description"] });

  const channelOptions: SelectOption[] = (channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));
  if (giveaway && !channelOptions.some((o) => o.value === giveaway.channelId)) channelOptions.push({ value: giveaway.channelId, label: giveaway.channelId });
  const roleOptions = (empty: string): SelectOption[] => [{ value: "", label: empty }, ...(roles ?? []).map((r) => ({ value: r.id, label: r.name }))];

  const submit = (start: boolean) =>
    form.handleSubmit((values) => {
      const ends = values.endsLocal ? new Date(values.endsLocal) : null;
      const checked = giveawayInput.safeParse({
        ...(giveaway ? { id: giveaway.id } : {}),
        channelId: values.channelId,
        prize: values.prize,
        description: values.description,
        winnerCount: values.winnerCount,
        endsAt: ends && !Number.isNaN(ends.getTime()) ? ends.toISOString() : "",
        requiredRoleId: values.requiredRoleId,
        pingRoleId: values.pingRoleId,
        start,
      });
      if (!checked.success) {
        form.clearErrors();
        for (const issue of checked.error.issues) {
          const key = issue.path[0];
          if (key === "endsAt") form.setError("endsLocal", { type: "custom", message: issue.message });
          else if (key === "channelId" || key === "prize" || key === "winnerCount") form.setError(key, { type: "custom", message: issue.message });
        }
        return;
      }
      startTransition(async () => {
        const result = await saveGiveawayAction(checked.data);
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
        <Field data-invalid={Boolean(errors.prize) || undefined}>
          <FieldLabel htmlFor="gw-prize">{t("prize")}</FieldLabel>
          <Input id="gw-prize" maxLength={MAX_PRIZE} aria-invalid={Boolean(errors.prize) || undefined} {...form.register("prize")} />
          {errors.prize && <FieldError>{te("needsPrize")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="gw-desc">{t("description")}</FieldLabel>
          <Textarea id="gw-desc" rows={3} maxLength={MAX_GIVEAWAY_DESCRIPTION} {...form.register("description")} />
          <FieldDescription>{t("descriptionHelp", { count: description.length, max: MAX_GIVEAWAY_DESCRIPTION })}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="gw-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="gw-channel" options={channelOptions} placeholder={t("channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field data-invalid={Boolean(errors.winnerCount) || undefined}>
            <FieldLabel htmlFor="gw-winners">{t("winners")}</FieldLabel>
            <Input id="gw-winners" type="number" inputMode="numeric" min={1} max={MAX_WINNERS} className="max-w-[7rem]" {...form.register("winnerCount", { valueAsNumber: true })} />
          </Field>
          <Field data-invalid={Boolean(endError) || undefined}>
            <FieldLabel htmlFor="gw-ends">{t("ends")}</FieldLabel>
            <Input id="gw-ends" type="datetime-local" min={minLocal} aria-invalid={Boolean(endError) || undefined} {...form.register("endsLocal")} />
            {endError && <FieldError>{te(endError === "past" ? "endPast" : endError === "tooFar" ? "endTooFar" : "endTime")}</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="gw-required">{t("required")}</FieldLabel>
          <FormSelect control={form.control} name="requiredRoleId" id="gw-required" options={roleOptions(t("everyone"))} placeholder={t("everyone")} disabled={roles === null} />
          <FieldDescription>{t("requiredHelp")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="gw-ping">{t("ping")}</FieldLabel>
          <FormSelect control={form.control} name="pingRoleId" id="gw-ping" options={roleOptions(t("nobody"))} placeholder={t("nobody")} disabled={roles === null} />
          <FieldDescription>{t("pingHelp")}</FieldDescription>
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
