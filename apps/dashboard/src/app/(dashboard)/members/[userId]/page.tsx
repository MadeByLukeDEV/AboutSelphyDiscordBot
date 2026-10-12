import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { snowflake } from "@aboutselphy/shared";
import { requireStaffPage } from "@/modules/auth";
import { getMemberPage } from "@/modules/moderation";
import { CasesList } from "@/modules/moderation/components/cases-list";
import { MemberActions } from "@/modules/moderation/components/member-actions";

type Props = { params: Promise<{ userId: string }> };

export async function generateMetadata() {
  return { title: (await getTranslations("Members"))("title") };
}

export default async function MemberPage({ params }: Props) {
  const { userId } = await params;
  await requireStaffPage(`/members/${encodeURIComponent(userId)}`);
  if (!snowflake.safeParse(userId).success) notFound();

  const t = await getTranslations("Members");
  const tt = await getTranslations("Moderation.types");
  const member = await getMemberPage(userId);
  const label = member.name ?? userId;

  return (
    <div className="flex flex-col gap-fluid">
      <header className="flex flex-col gap-2">
        <Link href="/members" className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("back")}
        </Link>
        <h1 className="text-fluid-2xl font-bold tracking-tight break-words">{label}</h1>
        <p className="text-sm text-muted-foreground tabular-nums">{userId}</p>
        <p className="text-sm text-muted-foreground">
          {t("summary", { total: member.rows.length, warnings: member.activeWarnings })}
          {Object.entries(member.counts).length > 0 && ` · ${Object.entries(member.counts).map(([type, n]) => `${tt(type as never)} ${n}`).join(", ")}`}
        </p>
      </header>

      <MemberActions userId={userId} name={label} />

      <section aria-labelledby="history-heading" className="flex flex-col gap-3">
        <h2 id="history-heading" className="text-fluid-lg font-semibold">
          {t("history")}
        </h2>
        {member.rows.length > 0 ? <CasesList rows={member.rows} /> : <p className="text-sm text-muted-foreground">{t("none")}</p>}
      </section>
    </div>
  );
}
