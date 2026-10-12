import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { MemberLookup } from "@/modules/moderation/components/member-lookup";

export async function generateMetadata() {
  return { title: (await getTranslations("Members"))("title") };
}

export default async function MembersPage() {
  // Moderators and admins; every action re-checks the session.
  await requireStaffPage("/members");
  const t = await getTranslations("Members");

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <MemberLookup />
    </>
  );
}
