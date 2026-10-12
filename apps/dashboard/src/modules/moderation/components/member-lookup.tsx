"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Hit = { id: string; username: string; name: string; inServer: boolean };
type SearchState = { query: string; members: Hit[]; botDown: boolean } | null;

// Mirrors MEMBER_SEARCH_MIN/MAX in @aboutselphy/shared (not imported: that index carries the word lists).
const MIN = 2;
const MAX = 32;

/** Open a member's page by Discord ID, or search the server (and earlier cases) by name. */
export function MemberLookup() {
  const t = useTranslations("Members.lookup");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [bad, setBad] = useState(false);
  const [result, setResult] = useState<SearchState>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    // A mention or a pasted "<@123>" also works: only the digits count.
    const id = value.replace(/[<@!>\s]/g, "");
    if (/^\d{17,20}$/.test(id)) return router.push(`/members/${id}`);
    const query = value.trim();
    if (query.length < MIN || query.length > MAX) return void setBad(true);
    startTransition(async () => {
      setFailed(false);
      try {
        const res = await fetch(`/api/members/search?q=${encodeURIComponent(query)}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { members: Hit[]; botDown: boolean };
        setResult({ query, members: body.members, botDown: body.botDown });
      } catch {
        setResult(null);
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="surface flex flex-col gap-3 p-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field data-invalid={bad || failed || undefined}>
          <FieldLabel htmlFor="member-id">{t("label")}</FieldLabel>
          <div className="flex flex-wrap gap-2">
            <Input id="member-id" autoComplete="off" placeholder={t("placeholder")} className="max-w-[20rem]" maxLength={64} aria-invalid={bad || undefined} value={value} onChange={(e) => (setValue(e.target.value), setBad(false))} />
            <Button type="submit" disabled={pending}>
              <Search aria-hidden />
              {pending ? t("searching") : t("open")}
            </Button>
          </div>
          <FieldDescription>{t("help")}</FieldDescription>
          {bad && <FieldError>{t("bad")}</FieldError>}
          {failed && <FieldError>{t("failed")}</FieldError>}
        </Field>
      </form>

      {result && (
        <section className="surface flex flex-col gap-3 p-5" aria-live="polite">
          <h2 className="text-lg font-semibold">{t("results", { query: result.query })}</h2>
          {result.botDown && <p className="text-sm text-muted-foreground">{t("botDown")}</p>}
          {result.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noResults")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {result.members.map((m) => (
                <li key={m.id}>
                  <Link href={`/members/${m.id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 hover:underline">
                    <span className="min-w-0 truncate font-medium">
                      {m.name}
                      {m.username !== m.name && <span className="font-normal text-muted-foreground"> @{m.username}</span>}
                    </span>
                    <span className="text-sm text-muted-foreground">{m.inServer ? t("inServer") : t("notInServer")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
