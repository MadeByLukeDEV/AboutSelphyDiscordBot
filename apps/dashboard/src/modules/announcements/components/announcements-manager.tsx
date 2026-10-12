"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildRole } from "@aboutselphy/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { deleteAnnouncementAction } from "../actions";
import type { AnnouncementView } from "../schema";
import { AnnouncementForm } from "./announcement-form";

type Editing = { announcement: AnnouncementView | null } | null;

const BAR: Record<AnnouncementView["status"], string> = {
  draft: "bg-muted-foreground/40",
  scheduled: "bg-primary",
  sending: "bg-primary",
  sent: "bg-emerald-500",
  failed: "bg-destructive",
};

/** The announcements as a list with compose, edit and delete. State flows in as props; changes call router.refresh(). */
export function AnnouncementsManager({
  announcements,
  channels,
  roles,
  canPingEveryone,
}: {
  announcements: AnnouncementView[];
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  /** Admins only. */
  canPingEveryone: boolean;
}) {
  const t = useTranslations("Announcements");
  const te = useTranslations("Announcements.errors");
  const format = useFormatter();
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<AnnouncementView | null>(null);
  const [pending, startTransition] = useTransition();

  const channelName = (id: string) => {
    const c = channels?.find((x) => x.id === id);
    return c ? `#${c.name}` : id;
  };

  const when = (a: AnnouncementView) => {
    const iso = a.status === "sent" ? a.sentAt : a.scheduledFor;
    return iso ? format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short" }) : null;
  };

  const snippet = (a: AnnouncementView) => {
    const text = (a.content || a.embedTitle || a.embedDescription).replace(/\s+/g, " ").trim();
    return text.length > 120 ? `${text.slice(0, 119)}…` : text;
  };

  function confirmRemove() {
    const target = removing;
    if (!target) return;
    startTransition(async () => {
      const result = await deleteAnnouncementAction(target.id);
      if (result.ok) {
        toast.success(t("removed"));
        setRemoving(null);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <section aria-labelledby="announcements-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="announcements-heading" className="text-fluid-lg font-bold">
          {t("list.title")}
        </h2>
        <Button size="sm" onClick={() => setEditing({ announcement: null })}>
          <Plus aria-hidden />
          {t("new")}
        </Button>
      </div>
      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      {announcements.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {announcements.map((a) => (
            <li key={a.id} className="surface flex overflow-hidden">
              <span className={cn("w-1.5 shrink-0", BAR[a.status])} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={a.status === "failed" ? "destructive" : a.status === "sent" || a.status === "scheduled" ? "default" : "secondary"}>
                      {t(`status.${a.status}`)}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{channelName(a.channelId)}</span>
                    {when(a) && <span className="text-sm text-muted-foreground tabular-nums">· {when(a)}</span>}
                  </div>
                  <p className="mt-1 truncate font-medium">{snippet(a) || t("list.noText")}</p>
                  {a.status === "failed" && <p className="text-sm text-destructive">{t(`failure.${a.lastError === "permissions" || a.lastError === "channel" || a.lastError === "interrupted" ? a.lastError : "discord"}`)}</p>}
                  <p className="text-xs text-muted-foreground">{t("list.by", { name: a.createdByName })}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {a.status !== "sending" && (
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ announcement: a })}>
                      {a.status === "failed" ? t("list.retry") : t("list.edit")}
                    </Button>
                  )}
                  {a.status !== "sending" && (
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRemoving(a)}>
                      {t("list.delete")}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Compose / edit. Mounted only while open and keyed by announcement, so it always starts from fresh values. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{editing?.announcement ? t("dialog.editTitle") : t("dialog.newTitle")}</DialogTitle>
            <DialogDescription>{editing?.announcement?.status === "sent" ? t("dialog.sentNote") : t("dialog.intro")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <AnnouncementForm
              key={editing.announcement?.id ?? "new"}
              announcement={editing.announcement}
              channels={channels}
              roles={roles}
              canPingEveryone={canPingEveryone}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("confirm.title")}</DialogTitle>
            <DialogDescription>{removing?.status === "sent" ? t("confirm.bodySent") : t("confirm.body")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("confirm.cancel")}</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={confirmRemove}>
              {t("list.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
