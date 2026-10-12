import { CheckCircle2, CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { isLinkOutcome } from "@/modules/twitchvip/link";

export async function generateMetadata() {
  return { title: (await getTranslations("VipLink"))("title") };
}

// Where "Link with Discord" ends. Public, shows only a fixed message for a known outcome code (anything else is
// treated as a failure), so nobody can make this page say something else through the address.
export default async function VipLinkPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const t = await getTranslations("VipLink");
  const raw = (await searchParams).status;
  const status = isLinkOutcome(raw) ? raw : "failed";
  const ok = status === "linked";
  const Icon = ok ? CheckCircle2 : CircleAlert;

  return (
    <section className="surface mx-auto flex w-full max-w-lg flex-col items-center gap-3 p-8 text-center">
      <Icon aria-hidden className={ok ? "size-10 text-brand-text" : "size-10 text-muted-foreground"} />
      <h1 className="text-fluid-xl font-bold">{ok ? t("doneTitle") : t("problemTitle")}</h1>
      <p className="text-muted-foreground">{t(`status.${status}`)}</p>
      <p className="text-sm text-muted-foreground">{t("back")}</p>
    </section>
  );
}
