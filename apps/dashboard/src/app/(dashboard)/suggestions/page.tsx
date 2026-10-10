import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getSuggestionsPage } from "@/modules/suggestions";
import { SuggestionsManager } from "@/modules/suggestions/components/suggestions-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Suggestions"))("title") };
}

export default async function SuggestionsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  // All staff can read and decide; only admins see the settings (the actions enforce it too).
  const session = await requireStaffPage("/suggestions");
  const t = await getTranslations("Suggestions");
  const { status } = await searchParams;
  const { settings, suggestions, perStatus, filter, channels } = await getSuggestionsPage(typeof status === "string" ? status : undefined);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <SuggestionsManager initial={settings} suggestions={suggestions} perStatus={perStatus} filter={filter} channels={channels} canEdit={isAdmin(session.user.role)} />
    </>
  );
}
