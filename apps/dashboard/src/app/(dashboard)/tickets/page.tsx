import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getTicketsPage } from "@/modules/tickets";
import { TicketsManager } from "@/modules/tickets/components/tickets-manager";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Tickets"))("title") };
}

export default async function TicketsPage() {
  // Moderators can read the tickets; only admins see the settings (the action enforces it too).
  const session = await requireStaffPage("/tickets");
  const t = await getTranslations("Tickets");
  const { settings, panelPosted, tickets, channels, roles, categories, ratings } = await getTicketsPage();

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />
      <TicketsManager initial={settings} panelPosted={panelPosted} tickets={tickets} channels={channels} roles={roles} categories={categories} ratings={ratings} canEdit={isAdmin(session.user.role)} />
    </>
  );
}
