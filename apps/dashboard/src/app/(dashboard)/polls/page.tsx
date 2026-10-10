import { getTranslations } from "next-intl/server";
import { requireStaffPage } from "@/modules/auth";
import { getPollsPage } from "@/modules/polls";
import { PollsManager } from "@/modules/polls/components/polls-manager";

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
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <PollsManager polls={polls} channels={channels} />
    </>
  );
}
