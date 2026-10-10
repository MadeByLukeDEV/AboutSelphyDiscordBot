"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { caseQueryString } from "../case-filter";
import { CASE_TYPES } from "../schema";

type Type = (typeof CASE_TYPES)[number];
const ALL = "all";

// The filter lives in the URL (?type=&q=&page=), so a filtered list can be
// bookmarked or shared and the back button works. Changing the action applies
// at once; the search applies on Enter or the button.
export function CasesFilter({ type, q }: { type?: Type; q?: string }) {
  const t = useTranslations("Moderation");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(q ?? "");

  const go = (next: { type?: Type; q?: string }) =>
    startTransition(() => router.push(`/cases${caseQueryString(next)}`));

  const items = [
    { value: ALL, label: t("search.allTypes") },
    ...CASE_TYPES.map((value) => ({ value, label: t(`types.${value}`) })),
  ];
  const filtered = Boolean(type || q);

  return (
    <form
      role="search"
      aria-label={t("search.label")}
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        go({ type, q: text.trim() || undefined });
      }}
    >
      <div className="relative min-w-[14rem] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("search.placeholder")}
          aria-label={t("search.label")}
          maxLength={100}
          className="h-9 pl-9"
        />
      </div>

      <Select
        items={items}
        value={type ?? ALL}
        onValueChange={(value) => go({ type: value === ALL ? undefined : (value as Type), q: text.trim() || undefined })}
      >
        <SelectTrigger aria-label={t("search.typeLabel")} className="h-9 w-[12rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="submit" size="sm" disabled={pending}>
        {t("search.submit")}
      </Button>
      {filtered && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setText("");
            go({});
          }}
        >
          <X aria-hidden />
          {t("search.clear")}
        </Button>
      )}
    </form>
  );
}
