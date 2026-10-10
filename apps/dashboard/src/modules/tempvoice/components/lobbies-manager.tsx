"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel } from "@aboutselphy/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { removeLobbyAction } from "../actions";
import type { LobbyView } from "../schema";
import { LobbyForm } from "./lobby-form";

type Editing = { kind: "new" } | { kind: "edit"; lobby: LobbyView } | null;

/** The lobbies as a list with add, edit and remove. Server state flows in as props; changes call router.refresh(). */
export function LobbiesManager({
  lobbies,
  channels,
  maxLobbies,
}: {
  lobbies: LobbyView[];
  /** null = the bot couldn't be reached, so the lists aren't available. */
  channels: GuildChannel[] | null;
  maxLobbies: number;
}) {
  const t = useTranslations("TempVoice.lobbies");
  const te = useTranslations("TempVoice.errors");
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<LobbyView | null>(null);
  const [pending, startTransition] = useTransition();

  const taken = new Set(lobbies.map((l) => l.channelId));
  const atLimit = lobbies.length >= maxLobbies;

  const channelName = (id: string) => {
    const c = channels?.find((x) => x.id === id);
    if (c) return c.parent ? `${c.name} (${c.parent})` : c.name;
    return channels === null ? id : `${t("channelGone")} (${id})`;
  };
  const categoryName = (id: string) => channels?.find((c) => c.id === id)?.name ?? id;

  function confirmRemove() {
    const lobby = removing;
    if (!lobby) return;
    startTransition(async () => {
      const result = await removeLobbyAction(lobby.id);
      if (result.ok) {
        toast.success(t("removed"));
        setRemoving(null);
        router.refresh();
      } else {
        toast.error(te(result.error, { max: maxLobbies }));
      }
    });
  }

  return (
    <section aria-labelledby="lobbies-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="lobbies-heading" className="text-fluid-lg font-semibold">
            {t("title")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("intro")}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground tabular-nums">{t("count", { count: lobbies.length, max: maxLobbies })}</span>
          <Button size="sm" onClick={() => setEditing({ kind: "new" })} disabled={atLimit}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        </div>
      </div>

      {channels === null && <p className="text-sm text-muted-foreground">{t("botOffline")}</p>}

      {lobbies.length === 0 ? (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed px-6 py-10 text-center">
          <h3 className="font-semibold">{t("empty.title")}</h3>
          <p className="max-w-md text-sm text-muted-foreground">{t("empty.body")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {lobbies.map((lobby) => (
            <li key={lobby.id} className="flex overflow-hidden rounded-xl border bg-card">
              <span className={cn("w-1.5 shrink-0", lobby.enabled ? "bg-primary" : "bg-muted-foreground/40")} aria-hidden />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-[12rem] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="min-w-0 truncate font-semibold">{channelName(lobby.channelId)}</h3>
                    {!lobby.enabled && <Badge variant="secondary">{t("paused")}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {lobby.categoryId ? t("inCategory", { category: categoryName(lobby.categoryId) }) : t("nextToLobby")}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    <span className="text-foreground">{lobby.nameTemplate}</span>
                    {", "}
                    {lobby.defaultUserLimit === 0 ? t("noLimit") : t("limit", { count: lobby.defaultUserLimit })}
                    {!lobby.allowVideoByDefault && `, ${t("videoOff")}`}
                    {!lobby.allowSoundboardByDefault && `, ${t("soundboardOff")}`}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing({ kind: "edit", lobby })}>
                    {t("edit")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setRemoving(lobby)}>
                    {t("remove")}
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add / edit. The form is only mounted while open, and keyed by lobby, so it always starts from fresh values. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing?.kind === "edit" ? t("dialog.editTitle") : t("dialog.addTitle")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <LobbyForm
              key={editing.kind === "edit" ? editing.lobby.id : "new"}
              lobby={editing.kind === "edit" ? editing.lobby : null}
              channels={channels}
              takenChannelIds={taken}
              maxLobbies={maxLobbies}
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
            <DialogTitle>{t("removeTitle")}</DialogTitle>
            <DialogDescription>{t("removeBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("dialog.cancel")}</DialogClose>
            <Button onClick={confirmRemove} disabled={pending}>
              {t("removeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
