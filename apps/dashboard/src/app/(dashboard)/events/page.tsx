import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getEventsPage } from "@/modules/eventcal";
import { EventsManager } from "@/modules/eventcal/components/events-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Events"))("title") };
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const session = await requireStaffPage("/events");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");
  const t = await getTranslations("Events");
  const { sources, rules, channels, roles, posted } = await getEventsPage();
  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <EventsManager sources={sources} rules={rules} channels={channels} roles={roles} posted={posted} initialTab={tab} />
    </>
  );
}
