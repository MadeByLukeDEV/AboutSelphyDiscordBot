import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getEventsPage } from "@/modules/eventcal";
import { EventsManager } from "@/modules/eventcal/components/events-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Events"))("title") };
}

export default async function EventsPage() {
  const session = await requireStaffPage("/events");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");
  const t = await getTranslations("Events");
  const { overview, rules, channels, roles, articles } = await getEventsPage();
  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <EventsManager overview={overview} rules={rules} channels={channels} roles={roles} articles={articles} />
    </>
  );
}
