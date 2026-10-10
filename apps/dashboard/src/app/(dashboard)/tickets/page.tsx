import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getTicketsPage } from "@/modules/tickets";
import { TicketsManager } from "@/modules/tickets/components/tickets-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Tickets"))("title") };
}

export default async function TicketsPage() {
  // Moderators can read the tickets; only admins see the settings (the action enforces it too).
  const session = await requireStaffPage("/tickets");
  const t = await getTranslations("Tickets");
  const { settings, panelPosted, tickets, channels, roles } = await getTicketsPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <TicketsManager initial={settings} panelPosted={panelPosted} tickets={tickets} channels={channels} roles={roles} canEdit={isAdmin(session.user.role)} />
    </>
  );
}
