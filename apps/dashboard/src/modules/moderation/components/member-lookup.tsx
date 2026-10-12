"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/** Open a member's page by their Discord ID (copied from Discord with Developer Mode, or from a case). */
export function MemberLookup() {
  const t = useTranslations("Members.lookup");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);

  return (
    <form
      className="surface flex flex-col gap-3 p-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        // A mention or a pasted "<@123>" also works: only the digits count.
        const id = value.replace(/[<@!>\s]/g, "");
        if (!/^\d{17,20}$/.test(id)) return void setBad(true);
        router.push(`/members/${id}`);
      }}
    >
      <Field data-invalid={bad || undefined}>
        <FieldLabel htmlFor="member-id">{t("label")}</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Input id="member-id" inputMode="numeric" autoComplete="off" placeholder="123456789012345678" className="max-w-[20rem]" aria-invalid={bad || undefined} value={value} onChange={(e) => (setValue(e.target.value), setBad(false))} />
          <Button type="submit">
            <Search aria-hidden />
            {t("open")}
          </Button>
        </div>
        <FieldDescription>{t("help")}</FieldDescription>
        {bad && <FieldError>{t("bad")}</FieldError>}
      </Field>
    </form>
  );
}
