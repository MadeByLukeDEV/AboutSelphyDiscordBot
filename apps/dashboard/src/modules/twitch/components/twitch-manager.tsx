"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { disconnectTwitchAction, removeStreamerAction, saveTwitchSettingsAction, setStreamerEnabledAction } from "../actions";
import type { ConnectOutcome, TwitchOverview, TwitchStreamerView } from "../schema";

type Confirm = { kind: "disconnect" } | { kind: "remove"; streamer: TwitchStreamerView } | null;

/** The connection, the two switches and the announced channels. State flows in as props; every change calls router.refresh(). */
export function TwitchManager({
  overview,
  channels,
  outcome,
}: {
  overview: TwitchOverview;
  /** Text channels, for names. null = the bot couldn't be reached (IDs are shown). */
  channels: GuildChannel[] | null;
  /** What happened on the way back from Twitch's login, if the page was opened from there. */
  outcome: ConnectOutcome | null;
}) {
  const t = useTranslations("Twitch");
  const te = useTranslations("Twitch.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const { connection, settings, streamers } = overview;

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

      {/* The channels */}
      <section aria-labelledby="twitch-streamers" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="twitch-streamers" className="text-fluid-lg font-bold">
            {t("streamers.title")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("streamers.intro")}</p>
        </div>
        {streamers.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
            <h3 className="font-semibold">{t("streamers.empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("streamers.empty.body")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {streamers.map((s) => (
              <li key={s.id} className="surface flex overflow-hidden">
                <span className={cn("w-1.5 shrink-0", s.enabled ? "bg-[#9146ff]" : "bg-muted-foreground/40")} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-[12rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate font-semibold">{s.displayName}</h3>
                      {!s.enabled && <Badge variant="secondary">{t("streamers.paused")}</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      twitch.tv/{s.login} → {channelName(s.channelId)}
                      {s.pingRoleId ? ` · ${t("streamers.pings")}` : ""}
                    </p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
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
        <p className="text-sm text-muted-foreground">{t("streamers.addHint")}</p>
      </section>

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
