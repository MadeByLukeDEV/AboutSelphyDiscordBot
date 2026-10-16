import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { getAuditPage, splitAction } from "@/modules/audit";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Audit"))("title") };
}

const VERBS = ["save", "set", "create", "update", "delete", "remove", "add", "approve", "pardon", "post", "upload", "rotate", "reset", "disconnect", "cleanup", "merge", "decide", "act", "edit", "giveaway", "poll"] as const;
const isVerb = (v: string): v is (typeof VERBS)[number] => (VERBS as readonly string[]).includes(v);

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireStaffPage("/audit");
  // Admins only (the nav hides it from moderators).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Audit");
  const format = await getFormatter();
  const raw = first((await searchParams).area);
  const { entries, areas } = await getAuditPage(raw && /^[a-z0-9-]{1,40}$/.test(raw) ? raw : null);
  const area = raw && areas.includes(raw) ? raw : null;

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />

      <nav aria-label={t("filter")} className="flex flex-wrap gap-2">
        <Link href="/audit" className={cn(buttonVariants({ variant: area === null ? "default" : "outline", size: "sm" }))}>
          {t("all")}
        </Link>
        {areas.map((a) => (
          <Link key={a} href={`/audit?area=${encodeURIComponent(a)}`} className={cn(buttonVariants({ variant: area === a ? "default" : "outline", size: "sm" }))}>
            {a}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {entries.map((e) => {
            const { verb, rest } = splitAction(e.action);
            return (
              <li key={e.id} className="surface flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3">
                <span className="w-44 shrink-0 text-sm text-muted-foreground tabular-nums">{format.dateTime(new Date(e.at), { dateStyle: "medium", timeStyle: "medium" })}</span>
                <span className="font-medium">{e.actorName}</span>
                <span className="text-xs text-muted-foreground">({e.actorRole})</span>
                <span className="min-w-0 flex-1 break-words">
                  <span className="font-semibold">{isVerb(verb) ? t(`verbs.${verb}`) : verb}</span> {rest} <span className="text-muted-foreground">· {e.area}</span>
                  {e.target && <span className="ml-1 text-xs text-muted-foreground tabular-nums">#{e.target}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </>
  );
}
