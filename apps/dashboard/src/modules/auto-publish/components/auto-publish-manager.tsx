"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { FormSelect, type SelectOption } from "@/components/form/form-select";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { addAutoPublishAction, removeAutoPublishAction } from "../actions";

type ChannelInfo = { id: string; name: string; parent: string | null };

/** The announcement channels whose messages are published automatically. State flows in as props; changes call router.refresh(). */
export function AutoPublishManager({ chosen, channels, available }: { chosen: string[]; channels: ChannelInfo[] | null; available: GuildChannel[] | null }) {
  const t = useTranslations("AutoPublish");
  const te = useTranslations("AutoPublish.errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<{ channelId: string }>({ defaultValues: { channelId: "" } });

  const name = (id: string) => (channels?.find((c) => c.id === id) ? `#${channels.find((c) => c.id === id)!.name}` : id);
  const options: SelectOption[] = (available ?? []).map((c) => ({ value: c.id, label: c.parent ? `#${c.name} (${c.parent})` : `#${c.name}`, text: `#${c.name}`, group: c.parent ?? undefined }));

  function run(task: () => Promise<{ ok: true } | { ok: false; error: string }>, success: string) {
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast.success(success);
        form.reset({ channelId: "" });
        router.refresh();
      } else {
        toast.error(te(result.error as "failed"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-fluid">
      <form
        className="surface flex flex-col gap-4 p-5"
        onSubmit={form.handleSubmit((values) => {
          if (!values.channelId) return void toast.error(te("pick"));
          run(() => addAutoPublishAction({ channelId: values.channelId }), t("added"));
        })}
        noValidate
      >
        <h2 className="text-fluid-lg font-bold">{t("add.title")}</h2>
        <Field>
          <FieldLabel htmlFor="ap-channel">{t("add.channel")}</FieldLabel>
          <FormSelect control={form.control} name="channelId" id="ap-channel" options={options} placeholder={t("add.placeholder")} disabled={available === null || options.length === 0} />
          <FieldDescription>{available === null ? t("botOffline") : options.length === 0 ? t("add.none") : t("add.help")}</FieldDescription>
        </Field>
        <div>
          <Button type="submit" disabled={pending || options.length === 0}>
            {t("add.button")}
          </Button>
        </div>
      </form>

      <section aria-labelledby="ap-list" className="flex flex-col gap-3">
        <h2 id="ap-list" className="text-fluid-lg font-bold">
          {t("list.title")}
        </h2>
        {chosen.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
            <h3 className="font-semibold">{t("empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {chosen.map((id) => (
              <li key={id} className="surface flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="font-semibold">{name(id)}</span>
                <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeAutoPublishAction({ channelId: id }), t("removed"))}>
                  {t("remove")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
