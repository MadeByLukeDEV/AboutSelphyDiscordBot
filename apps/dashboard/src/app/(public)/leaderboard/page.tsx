import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { getPublicLeaderboard } from "@/modules/levels";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  return { title: (await getTranslations("Leaderboard"))("title") };
}

// Public on purpose (members share the link), and only while an admin switched it on: otherwise it behaves like any other
// unknown address. It shows display names and XP only; members can hide themselves with /mydata hide.
export default async function LeaderboardPage() {
  const rows = await getPublicLeaderboard();
  if (rows === null) notFound();
  const t = await getTranslations("Leaderboard");
  const format = await getFormatter();

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.rank} className={cn("surface flex items-center gap-4 px-4 py-3", r.rank <= 3 && "surface-interactive")}>
              <span className="w-10 shrink-0 text-center text-fluid-lg font-bold tabular-nums">{r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : `${r.rank}.`}</span>
              <span className="min-w-0 flex-1 font-medium break-words">{r.name}</span>
              <span className="shrink-0 text-right text-sm">
                <span className="block font-semibold">{t("level", { level: r.level })}</span>
                <span className="block text-muted-foreground tabular-nums">{t("xp", { xp: format.number(r.xp) })}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
