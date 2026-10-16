import { getFormatter, getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getInvitesPage } from "@/modules/invites";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Invites"))("title") };
}

export default async function InvitesPage() {
  // Moderators and admins: it says who brought whom.
  await requireStaffPage("/invites");
  const t = await getTranslations("Invites");
  const format = await getFormatter();
  const { totals, top, rows } = await getInvitesPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />

      {totals.total === 0 ? (
        <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {([["tracked", totals.total], ["viaInvite", totals.viaInvite], ["viaVanity", totals.viaVanity], ["unknown", totals.unknown]] as const).map(([key, n]) => (
              <li key={key} className="surface flex flex-col p-4">
                <span className="text-fluid-2xl font-bold tabular-nums">{n}</span>
                <span className="text-sm text-muted-foreground">{t(`totals.${key}`)}</span>
              </li>
            ))}
          </ul>

          <section aria-labelledby="top-heading" className="flex flex-col gap-3">
            <h2 id="top-heading" className="text-fluid-lg font-bold">
              {t("top.title")}
            </h2>
            {top.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("top.none")}</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {top.map((r, i) => (
                  <li key={r.inviterId} className="surface flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                    <span className="w-6 shrink-0 text-muted-foreground tabular-nums">{i + 1}.</span>
                    <span className="min-w-0 flex-1 font-medium break-words">{r.name ?? r.inviterId}</span>
                    <span className="text-sm text-muted-foreground tabular-nums">{t("top.line", { total: r.total, here: r.here, left: r.total - r.here })}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-labelledby="recent-heading" className="flex flex-col gap-3">
            <h2 id="recent-heading" className="text-fluid-lg font-bold">
              {t("recent.title")}
            </h2>
            <ol className="flex flex-col gap-2">
              {rows.map((j) => (
                <li key={j.id} className="surface flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
                  <span className="w-40 shrink-0 text-sm text-muted-foreground tabular-nums">{format.dateTime(new Date(j.joinedAt), { dateStyle: "medium", timeStyle: "short" })}</span>
                  <span className="font-medium break-words">{j.userName}</span>
                  <span className="min-w-0 flex-1 text-sm break-words text-muted-foreground">
                    {j.source === "invite" ? t("recent.via", { who: j.inviterName ?? t("recent.someone"), code: j.code ?? "" }) : j.source === "vanity" ? t("recent.vanity") : t("recent.unknown")}
                    {j.left ? ` · ${t("recent.left")}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </>
      )}
      <p className="text-xs text-muted-foreground">{t("note")}</p>
    </>
  );
}
