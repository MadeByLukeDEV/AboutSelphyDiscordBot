import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import { BotStatusCard } from "@/modules/bot-status";
import { requireStaffPage } from "@/modules/auth";

export default async function OverviewPage() {
  // The proxy already gated this; pages re-check (prefetches skip the proxy).
  const session = await requireStaffPage("/");
  const t = await getTranslations("Overview");

  return (
    <AppShell session={session}>
      <header className="flex flex-col gap-1">
        <h1 className="text-fluid-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("welcome", { name: session.user.name })}</p>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </header>
      <div className="grid gap-fluid lg:grid-cols-2">
        <BotStatusCard />
      </div>
    </AppShell>
  );
}
