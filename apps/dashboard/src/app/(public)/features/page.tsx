import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FEATURE_GROUPS } from "@aboutselphy/shared/features";
import { PageHeader } from "@/components/page/page-header";

export async function generateMetadata() {
  return { title: (await getTranslations("Features"))("title") };
}

// Public on purpose: members (and people thinking of joining) can see what the bot does for them. It lists only member features,
// never staff tools or settings. The list is shared with the bot's own test, so a new command can't be left out.
export default async function FeaturesPage() {
  const t = await getTranslations("Features");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("intro")} />
      {FEATURE_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`f-${group.id}`} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 id={`f-${group.id}`} className="text-fluid-lg font-bold">
              {t(`groups.${group.id}.title` as never)}
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t(`groups.${group.id}.intro` as never)}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {group.items.map((item) => (
              <li key={item.key} className="surface flex flex-col gap-2 p-4">
                <h3 className="font-semibold">{t(`items.${item.key}.title` as never)}</h3>
                <p className="text-sm text-muted-foreground">{t(`items.${item.key}.body` as never)}</p>
                {item.commands.length > 0 && (
                  <p className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {item.commands.map((c) => (
                      <code key={c} className="rounded-md bg-muted px-1.5 py-0.5 text-xs">
                        {c}
                      </code>
                    ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-sm text-muted-foreground">
        {t("footer")}{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
          {t("privacy")}
        </Link>
      </p>
    </div>
  );
}
