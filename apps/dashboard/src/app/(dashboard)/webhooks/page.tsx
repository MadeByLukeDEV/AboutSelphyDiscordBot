import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getWebhooksPage } from "@/modules/webhooks";
import { WebhooksManager } from "@/modules/webhooks/components/webhooks-manager";

export async function generateMetadata() {
  return { title: (await getTranslations("Webhooks"))("title") };
}

export default async function WebhooksPage() {
  const session = await requireStaffPage("/webhooks");
  // Admins only (the nav hides it from moderators; this and the actions enforce it).
  if (!isAdmin(session.user.role)) redirect("/");

  const t = await getTranslations("Webhooks");
  const { endpoints, outbound, channels, ready } = await getWebhooksPage();

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="max-w-prose text-muted-foreground">{t("intro")}</p>
      </header>
      <WebhooksManager endpoints={endpoints} outbound={outbound} channels={channels} ready={ready} />
    </>
  );
}
