import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireStaffPage } from "@/modules/auth";
import { getTicketDetail } from "@/modules/tickets";

const numberSchema = z.coerce.number().int().positive().max(2_147_483_647);

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  return { title: `#${number}` };
}

export default async function TicketPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const parsed = numberSchema.safeParse(number);
  if (!parsed.success) notFound();
  await requireStaffPage(`/tickets/${parsed.data}`);
  const ticket = await getTicketDetail(parsed.data);
  if (!ticket) notFound();

  const t = await getTranslations("Tickets.detail");
  const format = await getFormatter();
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link href="/tickets" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("back")}
        </Link>
        <h1 className="text-fluid-2xl font-bold tracking-tight tabular-nums">{t("title", { number: ticket.number })}</h1>
        <dl className="surface grid gap-x-6 gap-y-2 p-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">{t("opener")}</dt><dd className="font-medium">{ticket.openerName} <span className="text-muted-foreground">({ticket.openerId})</span></dd></div>
          <div><dt className="text-muted-foreground">{t("status")}</dt><dd className="font-medium">{ticket.status === "open" ? t("open") : t("closed")}</dd></div>
          <div><dt className="text-muted-foreground">{t("opened")}</dt><dd className="font-medium">{when(ticket.createdAt)}</dd></div>
          {ticket.closedAt && <div><dt className="text-muted-foreground">{t("closedAt")}</dt><dd className="font-medium">{when(ticket.closedAt)}{ticket.closedByName ? ` · ${ticket.closedByName}` : ""}</dd></div>}
          {ticket.claimedByName && <div><dt className="text-muted-foreground">{t("claimedBy")}</dt><dd className="font-medium">{ticket.claimedByName}</dd></div>}
          {ticket.closeReason && <div><dt className="text-muted-foreground">{t("reason")}</dt><dd className="font-medium">{ticket.closeReason}</dd></div>}
            {ticket.categoryLabel && <div><dt className="text-muted-foreground">{t("type")}</dt><dd className="font-medium">{ticket.categoryLabel}</dd></div>}
            {ticket.topic && <div><dt className="text-muted-foreground">{t("topic")}</dt><dd className="font-medium break-words">{ticket.topic}</dd></div>}
            {ticket.rating && <div><dt className="text-muted-foreground">{t("rating")}</dt><dd className="font-medium">{"★".repeat(ticket.rating)}{"☆".repeat(5 - ticket.rating)}</dd></div>}
        </dl>
      </header>

      {ticket.transcript === null ? (
        <p className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">{ticket.status === "open" ? t("stillOpen") : t("noTranscript")}</p>
      ) : (
        <section aria-labelledby="transcript" className="flex flex-col gap-3">
          <h2 id="transcript" className="text-fluid-lg font-bold">
            {t("transcript", { count: ticket.transcript.messages.length })}
          </h2>
          {ticket.transcript.truncated && <p className="text-sm text-muted-foreground">{t("truncated")}</p>}
          <ol className="flex flex-col gap-2">
            {ticket.transcript.messages.map((m) => (
              <li key={m.id} className="surface flex flex-col gap-1 px-4 py-3">
                <p className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-semibold">{m.authorName}</span>
                  {m.authorBot && <span className="rounded bg-primary/15 px-1 text-xs">{t("bot")}</span>}
                  <span className="text-xs text-muted-foreground tabular-nums">{when(m.at)}</span>
                </p>
                {/* Plain text: React escapes it, so nothing a member typed can become markup or a link. */}
                {m.content && <p className="text-sm break-words whitespace-pre-wrap">{m.content}</p>}
                {m.attachments.length > 0 && (
                  <ul className="flex flex-wrap gap-2 text-sm">
                    {m.attachments.map((a) => (
                      <li key={a.url}>
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                          📎 {a.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {m.embeds > 0 && <p className="text-xs text-muted-foreground">{t("embeds", { count: m.embeds })}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
