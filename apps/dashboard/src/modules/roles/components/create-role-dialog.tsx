"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { colorToHex, hexToColor } from "@aboutselphy/shared/twitch-template";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createRoleAction } from "../actions";
import { createRoleInput, type CreateRoleInput } from "../schema";
import { ColorPicker } from "@/components/form/color-picker";

const DEFAULTS: CreateRoleInput = { name: "", color: 0x99aab5, hoist: false, mentionable: false };

/**
 * A form to create a cosmetic role in Discord. The role has a name and a colour and never any
 * permission, so it can't be used to gain power. `onCreated` gets the new role (the page
 * refreshes its lists too).
 */
export function CreateRoleDialog({
  onCreated,
  trigger = "button",
}: {
  onCreated?: (role: { id: string; name: string; color: number }) => void;
  trigger?: "button" | "small";
}) {
  const t = useTranslations("Roles.create");
  const te = useTranslations("Roles.errors");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<CreateRoleInput>({ resolver: zodResolver(createRoleInput), defaultValues: DEFAULTS });
  const { errors } = form.formState;
  const color = useWatch({ control: form.control, name: "color" });

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const result = await createRoleAction(values);
      if (result.ok) {
        toast.success(t("created", { name: result.role.name }));
        onCreated?.(result.role);
        form.reset(DEFAULTS);
        setOpen(false);
      } else {
        toast.error(te(result.error));
      }
    }),
  );

  return (
    <>
      <Button type="button" size="sm" variant={trigger === "small" ? "outline" : "default"} onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("intro")}</DialogDescription>
          </DialogHeader>
          {/* stopPropagation: React bubbles a portal's submit up to a parent form (the panel form this dialog can sit in). */}
          <form
            onSubmit={(e) => {
              e.stopPropagation();
              void onSubmit(e);
            }}
            className="flex flex-col gap-5"
            noValidate
          >
            <FieldGroup>
              <Field data-invalid={Boolean(errors.name) || undefined}>
                <FieldLabel htmlFor="role-name">{t("name")}</FieldLabel>
                <Input id="role-name" maxLength={100} autoComplete="off" aria-invalid={Boolean(errors.name) || undefined} {...form.register("name")} />
                {errors.name && <FieldError>{te("invalid")}</FieldError>}
              </Field>
              <Field>
                <FieldLabel htmlFor="role-color">{t("color")}</FieldLabel>
                <div className="flex items-center gap-2">
                  <ColorPicker id="role-color" value={colorToHex(color)} onChange={(hex) => {
                      const next = hexToColor(hex);
                      if (next !== undefined) form.setValue("color", next, { shouldDirty: true });
                    }} />
                </div>
              </Field>
              <Field orientation="horizontal">
                <Controller control={form.control} name="hoist" render={({ field }) => <Switch id="role-hoist" checked={field.value} onCheckedChange={field.onChange} />} />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="role-hoist">{t("hoist")}</FieldLabel>
                  <FieldDescription>{t("hoistHelp")}</FieldDescription>
                </div>
              </Field>
              <Field orientation="horizontal">
                <Controller control={form.control} name="mentionable" render={({ field }) => <Switch id="role-mentionable" checked={field.value} onCheckedChange={field.onChange} />} />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="role-mentionable">{t("mentionable")}</FieldLabel>
                  <FieldDescription>{t("mentionableHelp")}</FieldDescription>
                </div>
              </Field>
            </FieldGroup>
            <p className="text-xs text-muted-foreground">{t("noPermissions")}</p>
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? t("creating") : t("submit")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
