import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getGiveawaysPage } from "@/modules/giveaways";
import { GiveawaysManager } from "@/modules/giveaways/components/giveaways-manager";
import { PageHeader } from "@/components/page/page-header";

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
      <PageHeader title={t("title")} description={t("intro")} />
      <GiveawaysManager giveaways={giveaways} channels={channels} roles={roles} />
    </>
  );
}
