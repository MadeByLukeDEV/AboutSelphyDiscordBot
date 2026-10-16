import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isAdmin, requireStaffPage } from "@/modules/auth";
import { getWebhooksPage } from "@/modules/webhooks";
import { WebhooksManager } from "@/modules/webhooks/components/webhooks-manager";
import { PageHeader } from "@/components/page/page-header";

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
      <PageHeader title={t("title")} description={t("intro")} />
      <WebhooksManager endpoints={endpoints} outbound={outbound} channels={channels} ready={ready} />
    </>
  );
}
