import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getBirthdaysPage } from "@/modules/birthdays";
import { BirthdaysManager } from "@/modules/birthdays/components/birthdays-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Birthdays"))("title") };
}

export default async function BirthdaysPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await requireStaffPage("/birthdays");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Birthdays");
  const { settings, birthdays, total, channels, roles, cardImage } = await getBirthdaysPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <BirthdaysManager initial={settings} birthdays={birthdays} total={total} channels={channels} roles={roles} cardImage={cardImage} initialTab={tab} />
    </>
  );
}
