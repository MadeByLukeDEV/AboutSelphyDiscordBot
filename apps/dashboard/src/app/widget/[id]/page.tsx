import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getPublicFeed } from "@/modules/eventcal";
import { LocalRange } from "@/modules/eventcal/components/local-range";

export const metadata = { title: "Events" };

const ICON: Record<string, string> = { drop: "🎁", event: "📅", update: "🛠️", sale: "🏷️", other: "•" };

// Public on purpose and only for a game whose owner switched the widget on (otherwise it is a plain 404). Meant for an OBS browser
// source or an iframe: transparent background, refreshes itself every five minutes without scripts. Plain text only, no links.
export default async function WidgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const feed = await getPublicFeed(id);
  if (!feed) notFound();
  const locale = await getLocale();

  return (
    <>
      <meta httpEquiv="refresh" content="300" />
      <style>{"html,body{background:transparent!important}"}</style>
      <section className="mx-auto flex max-w-xl flex-col gap-3 p-4" style={{ ["--accent" as string]: feed.accentColor }}>
        <h1 className="text-lg font-bold" style={{ color: feed.accentColor }}>{feed.game}</h1>
        {feed.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming events.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {feed.events.map((e, i) => (
              <li key={`${e.title}-${i}`} className="rounded-xl border bg-background/80 px-3 py-2" style={{ borderLeft: `0.25rem solid ${feed.accentColor}` }}>
                <p className="font-semibold break-words">{ICON[e.kind] ?? "•"} {e.title}</p>
                <p className="text-sm text-muted-foreground">
                  <LocalRange start={e.startsAt} end={e.recurrence ? null : e.endsAt} allDay={e.allDay} locale={locale} />
                  {e.recurrence ? ` · ${e.recurrence}` : ""}
                </p>
                {e.items.length > 0 && <p className="mt-1 text-sm break-words">{e.items.slice(0, 8).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
