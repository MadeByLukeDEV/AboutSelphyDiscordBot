import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getPollsPage } from "@/modules/polls";
import { PollsManager } from "@/modules/polls/components/polls-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Polls"))("title") };
}

export default async function PollsPage() {
  // Moderators and admins may run polls; every action re-checks the session.
  await requireStaffPage("/polls");
  const t = await getTranslations("Polls");
  const { polls, channels } = await getPollsPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <PollsManager polls={polls} channels={channels} />
    </>
  );
}
