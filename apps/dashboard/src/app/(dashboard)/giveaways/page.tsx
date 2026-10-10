import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getGiveawaysPage } from "@/modules/giveaways";
import { GiveawaysManager } from "@/modules/giveaways/components/giveaways-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Giveaways"))("title") };
}

export default async function GiveawaysPage() {
  // Moderators and admins may run giveaways; every action re-checks the session.
  await requireStaffPage("/giveaways");
  const t = await getTranslations("Giveaways");
  const { giveaways, channels, roles } = await getGiveawaysPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <GiveawaysManager giveaways={giveaways} channels={channels} roles={roles} />
    </>
  );
}
