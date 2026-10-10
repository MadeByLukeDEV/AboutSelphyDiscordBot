import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getBirthdaysPage } from "@/modules/birthdays";
import { BirthdaysManager } from "@/modules/birthdays/components/birthdays-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Birthdays"))("title") };
}

export default async function BirthdaysPage() {
  const session = await requireStaffPage("/birthdays");
  // Admins only (the nav hides it from moderators; this and the action enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Birthdays");
  const { settings, birthdays, total, channels, roles, cardImage } = await getBirthdaysPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <BirthdaysManager initial={settings} birthdays={birthdays} total={total} channels={channels} roles={roles} cardImage={cardImage} />
    </>
  );
}
