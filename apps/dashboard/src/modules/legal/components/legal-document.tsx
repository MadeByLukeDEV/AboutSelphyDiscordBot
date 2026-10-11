import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { LegalDoc } from "../types";

/** Renders a legal document as plain text: headings, paragraphs and lists, nothing else. */
export async function LegalDocument({ doc, updated, other }: { doc: LegalDoc; updated: string; other: { href: string; label: string } }) {
  const t = await getTranslations("Legal");
  return (
    <article className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-fluid-2xl font-bold tracking-tight">{doc.title}</h1>
        <p className="text-sm text-muted-foreground">{t("updated", { date: updated })}</p>
        <p className="max-w-prose text-muted-foreground">{doc.intro}</p>
        <nav aria-label={t("contents")} className="surface p-4">
          <h2 className="mb-2 text-sm font-semibold">{t("contents")}</h2>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={`#${s.id}`}>
                  {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </header>
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="flex scroll-mt-6 flex-col gap-3">
          <h2 id={`${s.id}-h`} className="text-fluid-lg font-bold">
            {s.heading}
          </h2>
          {s.blocks.map((block, i) =>
            typeof block === "string" ? (
              <p key={i} className="max-w-prose break-words leading-relaxed">
                {block}
              </p>
            ) : (
              <ul key={i} className="flex max-w-prose list-disc flex-col gap-2 pl-5 leading-relaxed marker:text-muted-foreground">
                {block.list.map((item, j) => (
                  <li key={j} className="break-words">
                    {item}
                  </li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
      <footer className="border-t pt-4 text-sm">
        <Link className="underline-offset-4 hover:underline" href={other.href}>
          {other.label}
        </Link>
      </footer>
    </article>
  );
}
