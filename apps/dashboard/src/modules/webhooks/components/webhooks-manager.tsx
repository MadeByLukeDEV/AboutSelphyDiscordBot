"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { ENDPOINT_PROVIDERS, endpointInput, MAX_ENDPOINTS, MAX_OUTBOUND, OUTBOUND_EVENTS, outboundInput, pastesSecret, type EndpointProvider, type OutboundEvent } from "@aboutselphy/shared/webhooks";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { deleteEndpointAction, deleteOutboundAction, rotateEndpointSecretAction, saveEndpointAction, saveOutboundAction, testOutboundAction } from "../actions";
import type { EndpointRow, OutboundRow } from "../schema";

/** Message keys can't contain dots, so "mod.case" is looked up as "mod_case". */
const EVENT_KEYS = { "mod.case": "mod_case", "twitch.live": "twitch_live", "member.joined": "member_joined", "level.up": "level_up" } as const satisfies Record<OutboundEvent, string>;
const eventKey = (ev: OutboundEvent) => EVENT_KEYS[ev];

type Reveal = { title: string; url?: string; secret: string } | null;

/** Incoming endpoints and outgoing webhooks. A secret is shown once, in a dialog, right after it is made. State flows in as props; changes call router.refresh(). */
export function WebhooksManager({ endpoints, outbound, channels, ready }: { endpoints: EndpointRow[]; outbound: OutboundRow[]; channels: GuildChannel[] | null; ready: boolean }) {
  const t = useTranslations("Webhooks");
  const te = useTranslations("Webhooks.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editEndpoint, setEditEndpoint] = useState<{ row: EndpointRow | null } | null>(null);
  const [editOutbound, setEditOutbound] = useState<{ row: OutboundRow | null } | null>(null);
  const [reveal, setReveal] = useState<Reveal>(null);
  const [confirm, setConfirm] = useState<{ kind: "endpoint" | "outbound" | "rotate"; id: string; name: string } | null>(null);

  const channelName = (id: string) => (channels?.find((c) => c.id === id) ? `#${channels.find((c) => c.id === id)!.name}` : id);
  const when = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : t("never"));

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

  function confirmAction() {
    if (!confirm) return;
    if (confirm.kind === "endpoint") return run(() => deleteEndpointAction(confirm.id), t("removed"));
    if (confirm.kind === "outbound") return run(() => deleteOutboundAction(confirm.id), t("removed"));
    startTransition(async () => {
      const result = await rotateEndpointSecretAction(confirm.id);
      setConfirm(null);
      if (result.ok && result.secret) setReveal({ title: t("reveal.rotatedTitle"), url: result.url, secret: result.secret });
      else if (!result.ok) toast.error(te(result.error));
      router.refresh();
    });
  }

  function test(row: OutboundRow) {
    startTransition(async () => {
      const result = await testOutboundAction(row.id);
      if (result.ok) toast.success(t("testOk"));
      else toast.error(te(result.error));
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-fluid">
      {!ready && <p className="surface p-4 text-sm text-destructive">{t("notReady")}</p>}

      {/* Incoming */}
      <section aria-labelledby="wh-in" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="wh-in" className="text-fluid-lg font-bold">
              {t("incoming.title")} <span className="text-sm font-normal text-muted-foreground">{t("count", { count: endpoints.length, max: MAX_ENDPOINTS })}</span>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t("incoming.intro")}</p>
          </div>
          <Button size="sm" disabled={!ready || endpoints.length >= MAX_ENDPOINTS || channels === null} onClick={() => setEditEndpoint({ row: null })}>
            <Plus aria-hidden />
            {t("incoming.add")}
          </Button>
        </div>
        {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}
        {endpoints.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">{t("incoming.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {endpoints.map((e) => (
              <li key={e.id} className="surface flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{e.name}</span>
                    <Badge variant={e.enabled ? "default" : "secondary"}>{e.enabled ? t("on") : t("off")}</Badge>
                    <Badge variant="outline">{t(`providers.${e.provider}`)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("incoming.posts", { channel: channelName(e.channelId) })} · {t("incoming.used", { uses: e.uses, time: when(e.lastUsedAt) })}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{e.url}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditEndpoint({ row: e })}>
                    {t("edit")}
                  </Button>
                  {!pastesSecret(e.provider) && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setConfirm({ kind: "rotate", id: e.id, name: e.name })}>
                      {t("incoming.rotate")}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ kind: "endpoint", id: e.id, name: e.name })}>
                    {t("remove")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Outgoing */}
      <section aria-labelledby="wh-out" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="wh-out" className="text-fluid-lg font-bold">
              {t("outgoing.title")} <span className="text-sm font-normal text-muted-foreground">{t("count", { count: outbound.length, max: MAX_OUTBOUND })}</span>
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t("outgoing.intro")}</p>
          </div>
          <Button size="sm" disabled={!ready || outbound.length >= MAX_OUTBOUND} onClick={() => setEditOutbound({ row: null })}>
            <Plus aria-hidden />
            {t("outgoing.add")}
          </Button>
        </div>
        {outbound.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">{t("outgoing.empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {outbound.map((o) => (
              <li key={o.id} className="surface flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{o.name}</span>
                    <Badge variant="secondary">{t(`kinds.${o.kind}`)}</Badge>
                    <Badge variant={o.enabled ? "default" : "secondary"}>{o.enabled ? t("on") : t("off")}</Badge>
                    {o.autoDisabled && !o.enabled && <Badge variant="destructive">{t("outgoing.autoDisabled")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {o.host} · {o.events.map((ev) => t(`events.${eventKey(ev)}`)).join(", ")}
                  </p>
                  <p className="text-xs text-muted-foreground">{o.lastStatus ? t("outgoing.last", { status: o.lastStatus, time: when(o.lastAt) }) : t("outgoing.neverSent")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => test(o)}>
                    {t("outgoing.test")}
                  </Button>
                  <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditOutbound({ row: o })}>
                    {t("edit")}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ kind: "outbound", id: o.id, name: o.name })}>
                    {t("remove")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={editEndpoint !== null} onOpenChange={(open) => !open && setEditEndpoint(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editEndpoint?.row ? t("incoming.editTitle") : t("incoming.newTitle")}</DialogTitle>
            <DialogDescription>{t("incoming.dialogIntro")}</DialogDescription>
          </DialogHeader>
          {editEndpoint && (
            <EndpointForm
              key={editEndpoint.row?.id ?? "new"}
              row={editEndpoint.row}
              channels={channels}
              onDone={(secret, url) => {
                setEditEndpoint(null);
                if (secret) setReveal({ title: t("reveal.createdTitle"), url, secret });
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOutbound !== null} onOpenChange={(open) => !open && setEditOutbound(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editOutbound?.row ? t("outgoing.editTitle") : t("outgoing.newTitle")}</DialogTitle>
            <DialogDescription>{t("outgoing.dialogIntro")}</DialogDescription>
          </DialogHeader>
          {editOutbound && (
            <OutboundForm
              key={editOutbound.row?.id ?? "new"}
              row={editOutbound.row}
              onDone={(secret) => {
                setEditOutbound(null);
                if (secret) setReveal({ title: t("reveal.outboundTitle"), secret });
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={reveal !== null} onOpenChange={(open) => !open && setReveal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reveal?.title}</DialogTitle>
            <DialogDescription>{t("reveal.once")}</DialogDescription>
          </DialogHeader>
          {reveal?.url && <CopyBox label={t("reveal.url")} value={reveal.url} />}
          {reveal && <CopyBox label={t("reveal.secret")} value={reveal.secret} />}
          <p className="text-sm text-muted-foreground">{reveal?.url ? t("reveal.howIncoming") : t("reveal.howOutgoing")}</p>
          <DialogFooter>
            <DialogClose render={<Button />}>{t("reveal.done")}</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm ? t(`confirm.${confirm.kind}.title`) : ""}</DialogTitle>
            <DialogDescription>{confirm ? t(`confirm.${confirm.kind}.body`, { name: confirm.name }) : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("confirm.back")}</DialogClose>
            <Button variant={confirm?.kind === "rotate" ? "default" : "destructive"} disabled={pending} onClick={confirmAction}>
              {confirm ? t(`confirm.${confirm.kind}.button`) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CopyBox({ label, value }: { label: string; value: string }) {
  const t = useTranslations("Webhooks.reveal");
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded-lg border bg-card px-3 py-2 text-xs">{value}</code>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={t("copy")}
          onClick={() => void navigator.clipboard.writeText(value).then(() => toast.success(t("copied")), () => toast.error(t("copyFailed")))}
        >
          <Copy aria-hidden />
        </Button>
      </div>
    </Field>
  );
}

function EndpointForm({ row, channels, onDone }: { row: EndpointRow | null; channels: GuildChannel[] | null; onDone: (secret: string | null, url: string) => void }) {
  const t = useTranslations("Webhooks.endpointForm");
  const te = useTranslations("Webhooks.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<{ name: string; channelId: string; enabled: boolean; provider: EndpointProvider; secret: string }>({
    defaultValues: row ? { name: row.name, channelId: row.channelId, enabled: row.enabled, provider: row.provider, secret: "" } : { name: "", channelId: "", enabled: true, provider: "generic", secret: "" },
  });
  const { errors } = form.formState;
  const provider = useWatch({ control: form.control, name: "provider" });
  const tp = useTranslations("Webhooks.providers");
  const providerOptions: SelectOption[] = ENDPOINT_PROVIDERS.map((p) => ({ value: p, label: tp(p) }));
  const options: SelectOption[] = (channels ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));
  if (row && !options.some((o) => o.value === row.channelId)) options.push({ value: row.channelId, label: row.channelId });

  const submit = form.handleSubmit((values) => {
    const checked = endpointInput.safeParse({ ...(row ? { id: row.id } : {}), ...values });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "name" || key === "channelId" || key === "secret") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveEndpointAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone(result.secret, result.url);
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="wh-name">{t("name")}</FieldLabel>
          <Input id="wh-name" maxLength={60} aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          <FieldDescription>{t("nameHelp")}</FieldDescription>
          {errors.name && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="wh-provider">{t("provider")}</FieldLabel>
          <FormSelect control={form.control} name="provider" id="wh-provider" options={providerOptions} placeholder={t("provider")} disabled={row !== null} />
          <FieldDescription>{t(`providerHelp.${provider}`)}</FieldDescription>
        </Field>
        {pastesSecret(provider) && row === null && (
          <Field data-invalid={Boolean(errors.secret) || undefined}>
            <FieldLabel htmlFor="wh-secret">{t(provider === "stripe" ? "stripeToken" : "kofiToken")}</FieldLabel>
            <Input id="wh-secret" type="password" autoComplete="off" maxLength={200} aria-invalid={Boolean(errors.secret) || undefined} {...form.register("secret")} />
            <FieldDescription>{t(provider === "stripe" ? "stripeTokenHelp" : "kofiTokenHelp")}</FieldDescription>
            {errors.secret && <FieldError>{te("needsToken")}</FieldError>}
          </Field>
        )}
        <Field data-invalid={Boolean(errors.channelId) || undefined}>
          <FieldLabel htmlFor="wh-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="wh-channel" options={options} placeholder={t("channelPlaceholder")} disabled={channels === null} invalid={Boolean(errors.channelId)} />
          {errors.channelId && <FieldError>{te("channelNotFound")}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="wh-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="wh-enabled">{t("enabled")}</FieldLabel>
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

function OutboundForm({ row, onDone }: { row: OutboundRow | null; onDone: (secret: string | null) => void }) {
  const t = useTranslations("Webhooks.outboundForm");
  const tk = useTranslations("Webhooks.kinds");
  const tev = useTranslations("Webhooks.events");
  const te = useTranslations("Webhooks.errors");
  const [pending, startTransition] = useTransition();
  const form = useForm<{ name: string; kind: "discord" | "generic"; url: string; events: OutboundEvent[]; enabled: boolean }>({
    defaultValues: row ? { name: row.name, kind: row.kind, url: "", events: row.events, enabled: row.enabled } : { name: "", kind: "generic", url: "", events: ["mod.case"], enabled: true },
  });
  const { errors } = form.formState;
  const kindOptions: SelectOption[] = (["generic", "discord"] as const).map((k) => ({ value: k, label: tk(k) }));

  const submit = form.handleSubmit((values) => {
    const checked = outboundInput.safeParse({ ...(row ? { id: row.id } : {}), ...values });
    if (!checked.success) {
      form.clearErrors();
      for (const issue of checked.error.issues) {
        const key = issue.path[0];
        if (key === "name" || key === "url" || key === "events") form.setError(key, { type: "custom", message: issue.message });
      }
      return;
    }
    startTransition(async () => {
      const result = await saveOutboundAction(checked.data);
      if (!result.ok) return void toast.error(te(result.error));
      toast.success(t("saved"));
      onDone(result.secret);
    });
  });

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-5" noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.name) || undefined}>
          <FieldLabel htmlFor="ow-name">{t("name")}</FieldLabel>
          <Input id="ow-name" maxLength={60} aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
          {errors.name && <FieldError>{te("needsName")}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor="ow-kind">{t("kind")}</FieldLabel>
          <FormSelect control={form.control} name="kind" id="ow-kind" options={kindOptions} disabled={row !== null} />
          <FieldDescription>{t("kindHelp")}</FieldDescription>
        </Field>
        <Field data-invalid={Boolean(errors.url) || undefined}>
          <FieldLabel htmlFor="ow-url">{t("url")}</FieldLabel>
          <Input id="ow-url" type="url" inputMode="url" autoComplete="off" maxLength={500} placeholder={row ? t("urlKeep") : "https://"} aria-invalid={Boolean(errors.url) || undefined} {...form.register("url")} />
          <FieldDescription>{row ? t("urlEditHelp", { host: row.host }) : t("urlHelp")}</FieldDescription>
          {errors.url && <FieldError>{te("badUrl")}</FieldError>}
        </Field>
        <Field data-invalid={Boolean(errors.events) || undefined}>
          <FieldLabel>{t("events")}</FieldLabel>
          <Controller
            control={form.control}
            name="events"
            render={({ field }) => (
              <div className="flex flex-col gap-2">
                {OUTBOUND_EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--color-primary)]"
                      checked={field.value.includes(ev)}
                      onChange={(e) => field.onChange(e.target.checked ? [...field.value, ev] : field.value.filter((x) => x !== ev))}
                    />
                    {tev(eventKey(ev))}
                  </label>
                ))}
              </div>
            )}
          />
          {errors.events && <FieldError>{te("needsEvent")}</FieldError>}
        </Field>
        <Field orientation="horizontal">
          <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="ow-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
          <FieldLabel htmlFor="ow-enabled">{t("enabled")}</FieldLabel>
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
