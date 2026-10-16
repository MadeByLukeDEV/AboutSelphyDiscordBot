import { getTranslations } from "next-intl/server";
import { BarChart3, CheckCircle2, ClipboardCheck, Gift, Lightbulb, Ticket, type LucideIcon } from "lucide-react";
import { Section } from "@/components/page/section";
import { StatTile } from "@/components/page/stat-tile";
import { getAttention } from "../service";

type Row = { key: "screening" | "tickets" | "suggestions"; href: string; icon: LucideIcon; attention: boolean } | { key: "giveaways" | "polls"; href: string; icon: LucideIcon; attention: false };

const ROWS: Row[] = [
  { key: "screening", href: "/screening", icon: ClipboardCheck, attention: true },
  { key: "tickets", href: "/tickets", icon: Ticket, attention: true },
  { key: "suggestions", href: "/suggestions", icon: Lightbulb, attention: true },
  { key: "giveaways", href: "/giveaways", icon: Gift, attention: false },
  { key: "polls", href: "/polls", icon: BarChart3, attention: false },
];

/**
 * "What needs me?": things waiting for a decision come first and are highlighted; things that are just running are shown calmly.
 * When nothing waits, it says so instead of showing a row of zeros.
 */
export async function AttentionPanel() {
  const t = await getTranslations("Overview.attention");
  const data = await getAttention();
  const waiting = ROWS.filter((r) => r.attention && data[r.key] > 0);
  const running = ROWS.filter((r) => !r.attention && data[r.key] > 0);

  return (
    <Section title={t("title")} description={t("intro")}>
      {waiting.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-brand-text" aria-hidden />
          {t("allClear")}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {waiting.map((r) => (
            <li key={r.key}>
              <StatTile href={r.href} icon={r.icon} value={data[r.key]} label={t(`items.${r.key}`, { count: data[r.key] })} tone="attention" />
            </li>
          ))}
        </ul>
      )}
      {running.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {running.map((r) => (
            <li key={r.key}>
              <StatTile href={r.href} icon={r.icon} value={data[r.key]} label={t(`items.${r.key}`, { count: data[r.key] })} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
