"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageTabs } from "@/components/page/page-tabs";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { disconnectTwitchAction, removeStreamerAction, saveTwitchSettingsAction, setStreamerEnabledAction } from "../actions";
import type { ConnectOutcome, TwitchOverview, TwitchSettings, TwitchStreamerView } from "../schema";
import { StreamerForm } from "./streamer-form";

type Confirm = { kind: "disconnect" } | { kind: "remove"; streamer: TwitchStreamerView } | null;

/** The connection, the two switches and the announced channels. State flows in as props; every change calls router.refresh(). */
export function TwitchManager({
  overview,
  channels,
  roles,
  maxStreamers,
  outcome,
  initialTab,
}: {
  overview: TwitchOverview;
  /** Text channels, for names. null = the bot couldn't be reached (IDs are shown). */
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  maxStreamers: number;
  /** What happened on the way back from Twitch's login, if the page was opened from there. */
  outcome: ConnectOutcome | null;
  initialTab?: string;
}) {
  const t = useTranslations("Twitch");
  const te = useTranslations("Twitch.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [editing, setEditing] = useState<{ streamer: TwitchStreamerView | null } | null>(null);
  const { connection, settings, streamers } = overview;

  const roleName = (id: string) => roles?.find((r) => r.id === id)?.name ?? id;
  const atLimit = streamers.length >= maxStreamers;

  const channelName = (id: string) => {
    const c = channels?.find((x) => x.id === id);
    return c ? `#${c.name}` : id;
  };

  function run(task: () => Promise<{ ok: true; botNotified?: boolean } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast.success(result.botNotified === false ? t("savedBotLater") : success);
        setConfirm(null);
        router.refresh();
      } else {
        toast.error(te(result.error as "failed"));
      }
    });
  }

  const saveSettings = (next: Partial<typeof settings>) =>
    run(() => saveTwitchSettingsAction({ ...settings, ...next }), t("saved"));

  return (
    <div className="flex flex-col gap-fluid">
      {outcome && (
        <p
          role="status"
          className={cn(
            "surface px-4 py-3 text-sm",
            outcome === "connected" ? "border-primary/40" : "border-destructive/50",
          )}
        >
          {t(`outcome.${outcome}`)}
        </p>
      )}

      <PageTabs
        initial={initialTab ?? (connection ? "channels" : "connection")}
        tabs={[
          {
            id: "channels",
            label: t("tabs.channels"),
            count: streamers.length,
            content: (
              <>
              {/* The channels */}
              <section aria-labelledby="twitch-streamers" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <h2 id="twitch-streamers" className="text-fluid-lg font-bold">
                      {t("streamers.title")}
                    </h2>
                    <p className="max-w-prose text-sm text-muted-foreground">{t("streamers.intro")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground tabular-nums">{t("streamers.count", { count: streamers.length, max: maxStreamers })}</span>
                    <Button size="sm" onClick={() => setEditing({ streamer: null })} disabled={atLimit || !connection}>
                      <Plus aria-hidden />
                      {t("streamers.add")}
                    </Button>
                  </div>
                </div>
                {!connection && <p className="text-sm text-muted-foreground">{t("streamers.needsConnection")}</p>}
                {atLimit && <p className="text-sm text-muted-foreground">{t("streamers.limitReached", { max: maxStreamers })}</p>}
                {streamers.length === 0 ? (
                  <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
                    <h3 className="font-semibold">{t("streamers.empty.title")}</h3>
                    <p className="max-w-md text-sm text-muted-foreground">{t("streamers.empty.body")}</p>
                  </div>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {streamers.map((s) => (
                      <li key={s.id} className="surface flex overflow-hidden">
                        <span className={cn("w-1.5 shrink-0", !s.enabled && "bg-muted-foreground/40")} style={s.enabled ? { backgroundColor: `#${s.embedColor.toString(16).padStart(6, "0")}` } : undefined} aria-hidden />
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                          <div className="min-w-[12rem] flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="min-w-0 truncate font-semibold">{s.displayName}</h3>
                              {!s.enabled && <Badge variant="secondary">{t("streamers.paused")}</Badge>}
                            </div>
                            <p className="truncate text-sm text-muted-foreground">
                              twitch.tv/{s.login} → {channelName(s.channelId)}
                              {s.pingRoleId ? ` · ${t("streamers.pings", { role: roleName(s.pingRoleId) })}` : ""}
                            </p>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ streamer: s })}>
                              {t("streamers.edit")}
                            </Button>
                            <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => setStreamerEnabledAction(s.id, !s.enabled), t("saved"))}>
                              {s.enabled ? t("streamers.pause") : t("streamers.resume")}
                            </Button>
                            <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirm({ kind: "remove", streamer: s })}>
                              {t("streamers.remove")}
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              </>
            ),
          },
          {
            id: "settings",
            label: t("tabs.settings"),
            content: (
              <>
              {/* The switches */}
              <section aria-labelledby="twitch-settings" className="surface flex flex-col gap-4 p-5">
                <h2 id="twitch-settings" className="text-fluid-lg font-bold">
                  {t("settings.title")}
                </h2>
                <Field orientation="horizontal">
                  <Switch id="tw-enabled" checked={settings.enabled} disabled={pending} onCheckedChange={(enabled) => saveSettings({ enabled })} aria-describedby="tw-enabled-help" />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="tw-enabled">{t("settings.enabled")}</FieldLabel>
                    <FieldDescription id="tw-enabled-help">{t("settings.enabledHelp")}</FieldDescription>
                  </div>
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    id="tw-ended"
                    checked={settings.markEndedOnOffline}
                    disabled={pending}
                    onCheckedChange={(markEndedOnOffline) => saveSettings({ markEndedOnOffline })}
                    aria-describedby="tw-ended-help"
                  />
                  <div className="flex flex-col gap-1">
                    <FieldLabel htmlFor="tw-ended">{t("settings.markEnded")}</FieldLabel>
                    <FieldDescription id="tw-ended-help">{t("settings.markEndedHelp")}</FieldDescription>
                  </div>
                </Field>
              </section>

              <LiveRoleForm key={settings.liveRoleId} settings={settings} roles={roles} pending={pending} onSave={saveSettings} />

              <ClipsForm key={settings.clipsChannelId} settings={settings} channels={channels} pending={pending} onSave={saveSettings} />
              </>
            ),
          },
          {
            id: "connection",
            label: t("tabs.connection"),
            content: (
              <>
              {/* The connection */}
              <section aria-labelledby="twitch-connection" className="surface flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 id="twitch-connection" className="text-fluid-lg font-bold">
                    {t("connection.title")}
                  </h2>
                  {connection && <Badge variant={connection.needsReconnect ? "destructive" : "default"}>{connection.needsReconnect ? t("connection.needsReconnect") : t("connection.connected")}</Badge>}
                </div>
                {!overview.ready ? (
                  <p className="text-sm text-muted-foreground">{t("connection.notConfigured")}</p>
                ) : connection ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t("connection.as", { login: connection.login })}
                      {connection.connectedByName ? ` · ${t("connection.by", { name: connection.connectedByName, date: format.dateTime(new Date(connection.connectedAt), { dateStyle: "medium" }) })}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground">{t("connection.explain")}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" nativeButton={false} render={<a href="/api/twitch/connect" />}>
                        {connection.needsReconnect ? t("connection.reconnect") : t("connection.switchAccount")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirm({ kind: "disconnect" })}>
                        {t("connection.disconnect")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{t("connection.none")}</p>
                    <div>
                      <Button size="sm" nativeButton={false} render={<a href="/api/twitch/connect" />}>
                        {t("connection.connect")}
                      </Button>
                    </div>
                  </>
                )}
              </section>
              </>
            ),
          },
        ]}
      />

      {/* Add / edit. Mounted only while open and keyed by channel, so it always starts from fresh values. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.streamer ? t("form.editTitle") : t("form.addTitle")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <StreamerForm
              key={editing.streamer?.id ?? "new"}
              streamer={editing.streamer}
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
            <DialogTitle>{confirm?.kind === "disconnect" ? t("confirm.disconnectTitle") : t("confirm.removeTitle")}</DialogTitle>
            <DialogDescription>
              {confirm?.kind === "disconnect" ? t("confirm.disconnectBody") : t("confirm.removeBody", { name: confirm?.streamer.displayName ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("confirm.cancel")}</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                if (!confirm) return;
                if (confirm.kind === "disconnect") run(() => disconnectTwitchAction(), t("connection.disconnected"));
                else run(() => removeStreamerAction(confirm.streamer.id), t("streamers.removed"));
              }}
            >
              {confirm?.kind === "disconnect" ? t("connection.disconnect") : t("streamers.remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


/** The role worn by a streamer's linked Discord member while they are live. */
function LiveRoleForm({ settings, roles, pending, onSave }: { settings: TwitchSettings; roles: GuildRole[] | null; pending: boolean; onSave: (next: Partial<TwitchSettings>) => void }) {
  const t = useTranslations("Twitch.liveRole");
  const form = useForm<{ liveRoleId: string }>({ defaultValues: { liveRoleId: settings.liveRoleId } });
  const options: SelectOption[] = [{ value: "", label: t("none") }, ...(roles ?? []).filter((r) => r.assignable).map((r) => ({ value: r.id, label: r.name }))];
  if (settings.liveRoleId && !options.some((o) => o.value === settings.liveRoleId)) options.push({ value: settings.liveRoleId, label: settings.liveRoleId });
  return (
    <section aria-labelledby="twitch-live-role" className="surface flex flex-col gap-3 p-5">
      <h2 id="twitch-live-role" className="text-fluid-lg font-bold">
        {t("title")}
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      <form onSubmit={form.handleSubmit((values) => onSave({ liveRoleId: values.liveRoleId }))} className="flex flex-col gap-3" noValidate>
        <Field>
          <FieldLabel htmlFor="tw-live-role">{t("role")}</FieldLabel>
          <FormSelect control={form.control} name="liveRoleId" id="tw-live-role" options={options} placeholder={t("none")} disabled={roles === null} />
          <FieldDescription>{roles === null ? t("botOffline") : t("help")}</FieldDescription>
        </Field>
        <div>
          <Button type="submit" size="sm" disabled={pending || !form.formState.isDirty}>
            {t("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}

/** Where new clips are posted (for channels that have "Post new clips" switched on). */
function ClipsForm({ settings, channels, pending, onSave }: { settings: TwitchSettings; channels: GuildChannel[] | null; pending: boolean; onSave: (next: Partial<TwitchSettings>) => void }) {
  const t = useTranslations("Twitch.clips");
  const form = useForm<{ clipsChannelId: string; clipsMinViews: number }>({ defaultValues: { clipsChannelId: settings.clipsChannelId, clipsMinViews: settings.clipsMinViews } });
  const options: SelectOption[] = [
    { value: "", label: t("none") },
    ...(channels ?? []).filter((c) => c.kind === "text").map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined })),
  ];
  if (settings.clipsChannelId && !options.some((o) => o.value === settings.clipsChannelId)) options.push({ value: settings.clipsChannelId, label: settings.clipsChannelId });
  return (
    <section aria-labelledby="twitch-clips" className="surface flex flex-col gap-3 p-5">
      <h2 id="twitch-clips" className="text-fluid-lg font-bold">
        {t("title")}
      </h2>
      <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
      <form onSubmit={form.handleSubmit((values) => onSave({ clipsChannelId: values.clipsChannelId, clipsMinViews: Math.max(0, Math.min(100_000, Math.trunc(Number(values.clipsMinViews) || 0))) }))} className="flex flex-col gap-3" noValidate>
        <Field>
          <FieldLabel htmlFor="tw-clips-channel">{t("channel")}</FieldLabel>
          <FormSelect control={form.control} name="clipsChannelId" id="tw-clips-channel" options={options} placeholder={t("none")} disabled={channels === null} />
          <FieldDescription>{channels === null ? t("botOffline") : t("help")}</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="tw-clips-views">{t("minViews")}</FieldLabel>
          <Input id="tw-clips-views" type="number" inputMode="numeric" min={0} max={100000} className="max-w-[9rem]" {...form.register("clipsMinViews", { valueAsNumber: true })} />
          <FieldDescription>{t("minViewsHelp")}</FieldDescription>
        </Field>
        <div>
          <Button type="submit" size="sm" disabled={pending || !form.formState.isDirty}>
            {t("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
