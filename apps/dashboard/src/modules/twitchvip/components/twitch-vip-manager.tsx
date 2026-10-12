"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { GuildRole } from "@aboutselphy/shared";
import { vipSettingsSchema, type VipSettings } from "@aboutselphy/shared/twitchvip";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { approveVipLinkAction, removeVipLinkAction, saveVipSettingsAction } from "../actions";
import type { VipLinkRow, VipState } from "../schema";

/** The VIP role settings, the state of the last sync, and the members' links (pending ones to confirm first). */
export function TwitchVipManager({ initial, state, links, roles }: { initial: VipSettings; state: VipState; links: VipLinkRow[]; roles: GuildRole[] | null }) {
  const t = useTranslations("TwitchVip");
  const te = useTranslations("TwitchVip.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const form = useForm<VipSettings>({ defaultValues: initial });
  const { errors, isDirty } = form.formState;

  const roleOptions: SelectOption[] = [{ value: "", label: t("noRole") }, ...(roles ?? []).filter((r) => r.assignable).map((r) => ({ value: r.id, label: r.name }))];
  if (initial.roleId && !roleOptions.some((o) => o.value === initial.roleId)) roleOptions.push({ value: initial.roleId, label: initial.roleId });

  const save = form.handleSubmit((values) => {
    const checked = vipSettingsSchema.safeParse(values);
    if (!checked.success) {
      form.setError("roleId", { type: "custom", message: "role" });
      return;
    }
    startTransition(async () => {
      const result = await saveVipSettingsAction(checked.data);
      if (result.ok) {
        toast.success(result.botNotified ? t("form.saved") : t("form.savedBotLater"));
        form.reset(result.settings);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  });

  function act(run: () => ReturnType<typeof approveVipLinkAction>, done: string) {
    startTransition(async () => {
      const result = await run();
      if (result.ok) {
        toast.success(done);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  const waiting = links.filter((l) => !l.approved);
  const confirmed = links.filter((l) => l.approved);

  return (
    <div className="flex flex-col gap-fluid">
      <section className="surface flex flex-col gap-2 p-5" aria-labelledby="vip-state">
        <h2 id="vip-state" className="text-fluid-lg font-bold">
          {t("state.title")}
        </h2>
        <p className="text-sm">{t(`state.${state.status}`)}</p>
        {state.status === "missingScope" && (
          <Link href="/twitch" className="w-fit text-sm font-medium text-brand-text underline underline-offset-4">
            {t("state.reconnect")}
          </Link>
        )}
        <p className="text-sm text-muted-foreground">
          {t("state.vips", { count: state.vipCount })}
          {state.lastSyncAt ? ` · ${t("state.last", { time: format.dateTime(new Date(state.lastSyncAt), { dateStyle: "medium", timeStyle: "short" }) })}` : ""}
        </p>
      </section>

      <form onSubmit={(e) => void save(e)} className="surface flex flex-col gap-5 p-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-fluid-lg font-bold">{t("form.title")}</h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("form.intro")}</p>
        </div>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.roleId) || undefined}>
            <FieldLabel htmlFor="vip-role">{t("form.role")}</FieldLabel>
            <FormSelect control={form.control} name="roleId" id="vip-role" options={roleOptions} placeholder={t("noRole")} disabled={roles === null} invalid={Boolean(errors.roleId)} />
            <FieldDescription>{roles === null ? t("form.botOffline") : t("form.roleHelp")}</FieldDescription>
            {errors.roleId && <FieldError>{te("needsRole")}</FieldError>}
          </Field>
          <Field orientation="horizontal">
            <Controller control={form.control} name="enabled" render={({ field }) => <Switch id="vip-enabled" checked={field.value} onCheckedChange={field.onChange} />} />
            <FieldLabel htmlFor="vip-enabled">{t("form.enabled")}</FieldLabel>
          </Field>
        </FieldGroup>
        <div>
          <Button type="submit" disabled={pending || !isDirty}>
            {pending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>

      <section className="flex flex-col gap-3" aria-labelledby="vip-waiting">
        <h2 id="vip-waiting" className="text-fluid-lg font-bold">
          {t("links.waiting")} <span className="text-sm font-normal text-muted-foreground">({waiting.length})</span>
        </h2>
        {waiting.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-6 text-center text-sm text-muted-foreground">{t("links.noneWaiting")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {waiting.map((l) => (
              <LinkItem key={l.id} link={l} pending={pending} format={format} t={t}>
                <Button size="sm" disabled={pending} onClick={() => act(() => approveVipLinkAction(l.id), t("links.approved"))}>
                  <Check aria-hidden />
                  {t("links.approve")}
                </Button>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => act(() => removeVipLinkAction(l.id), t("links.removed"))}>
                  {t("links.reject")}
                </Button>
              </LinkItem>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="vip-confirmed">
        <h2 id="vip-confirmed" className="text-fluid-lg font-bold">
          {t("links.confirmed")} <span className="text-sm font-normal text-muted-foreground">({confirmed.length})</span>
        </h2>
        {confirmed.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-6 py-6 text-center text-sm text-muted-foreground">{t("links.noneConfirmed")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {confirmed.map((l) => (
              <LinkItem key={l.id} link={l} pending={pending} format={format} t={t}>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => act(() => removeVipLinkAction(l.id), t("links.removed"))}>
                  <Trash2 aria-hidden />
                  {t("links.remove")}
                </Button>
              </LinkItem>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LinkItem({ link, children, format, t }: { link: VipLinkRow; pending: boolean; children: React.ReactNode; format: ReturnType<typeof useFormatter>; t: ReturnType<typeof useTranslations<"TwitchVip">> }) {
  return (
    <li className="surface flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <div className="min-w-[12rem] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold break-words">{link.discordName}</span>
          <Badge variant={link.approved ? "default" : "secondary"}>{link.approved ? t("links.badgeApproved") : t("links.badgePending")}</Badge>
        </div>
        <p className="text-sm break-words text-muted-foreground">
          twitch.tv/{link.twitchLogin} · {t("links.since", { time: format.dateTime(new Date(link.createdAt), { dateStyle: "medium" }) })}
          {link.approvedByName ? ` · ${t("links.by", { name: link.approvedByName })}` : ""}
        </p>
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  );
}
