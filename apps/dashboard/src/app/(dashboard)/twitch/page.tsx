import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MAX_TWITCH_STREAMERS } from "@aboutselphy/shared";
import { listChannels, listRoles } from "@/modules/bot-api";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getTwitchOverview, isConnectOutcome } from "@/modules/twitch";
import { TwitchManager } from "@/modules/twitch/components/twitch-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Twitch"))("title") };
}

export default async function TwitchPage({ searchParams }: { searchParams: Promise<{ connect?: string | string[] }> }) {
  const session = await requireStaffPage("/twitch");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Twitch");
  const { connect } = await searchParams;
  const [overview, channels, roles] = await Promise.all([getTwitchOverview(), listChannels(["text"]), listRoles()]);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <TwitchManager overview={overview} channels={channels} roles={roles} maxStreamers={MAX_TWITCH_STREAMERS} outcome={isConnectOutcome(connect) ? connect : null} />
    </>
  );
}
