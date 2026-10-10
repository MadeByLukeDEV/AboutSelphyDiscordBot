"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { GuildChannel, GuildEmoji, GuildRole } from "@aboutselphy/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { deletePanelAction } from "../actions";
import type { RolePanelView } from "../schema";
import { CreateRoleDialog } from "./create-role-dialog";
import { PanelForm } from "./panel-form";

type Editing = { panel: RolePanelView | null } | null;

/** The roles page: create a role, and the role panels (list, compose, edit, delete). State flows in as props; changes call router.refresh(). */
export function RolesManager({
  panels,
  channels,
  roles,
  emojis,
}: {
  panels: RolePanelView[];
  channels: GuildChannel[] | null;
  roles: GuildRole[] | null;
  /** The server's own emotes for the picker; null if the bot couldn't be reached. */
  emojis: GuildEmoji[] | null;
}) {
  const t = useTranslations("Roles");
  const te = useTranslations("Roles.errors");
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [removing, setRemoving] = useState<RolePanelView | null>(null);
  const [pending, startTransition] = useTransition();

  const channelName = (id: string) => {
    const c = channels?.find((x) => x.id === id);
    return c ? `#${c.name}` : id;
  };
  const roleName = (id: string) => roles?.find((r) => r.id === id)?.name ?? id;

  function confirmRemove() {
    const target = removing;
    if (!target) return;
    startTransition(async () => {
      const result = await deletePanelAction(target.id);
      if (result.ok) {
        toast.success(t("panels.removed"));
        setRemoving(null);
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-fluid">
      {/* Create a role */}
      <section aria-labelledby="roles-create" className="surface flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <h2 id="roles-create" className="text-fluid-lg font-bold">
            {t("create.sectionTitle")}
          </h2>
          <p className="max-w-prose text-sm text-muted-foreground">{t("create.sectionBody")}</p>
        </div>
        <CreateRoleDialog onCreated={() => router.refresh()} />
      </section>

      {/* Panels */}
      <section aria-labelledby="roles-panels" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 id="roles-panels" className="text-fluid-lg font-bold">
              {t("panels.title")}
            </h2>
            <p className="max-w-prose text-sm text-muted-foreground">{t("panels.intro")}</p>
          </div>
          <Button size="sm" onClick={() => setEditing({ panel: null })}>
            <Plus aria-hidden />
            {t("panels.new")}
          </Button>
        </div>
        {channels === null && <p className="text-sm text-muted-foreground">{t("panels.botOffline")}</p>}

        {panels.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed px-6 py-10 text-center">
            <h3 className="font-semibold">{t("panels.empty.title")}</h3>
            <p className="max-w-md text-sm text-muted-foreground">{t("panels.empty.body")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {panels.map((p) => (
              <li key={p.id} className="surface flex overflow-hidden">
                <span className={cn("w-1.5 shrink-0", p.messageId ? "bg-primary" : "bg-muted-foreground/40")} aria-hidden />
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-[12rem] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 truncate font-semibold">{p.title || t("panels.untitled")}</h3>
                      <Badge variant={p.messageId ? "default" : "secondary"}>{p.messageId ? t("panels.posted") : t("panels.draft")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {channelName(p.channelId)} · {t(`panel.styles.${p.style}`)}
                      {p.exclusive ? ` · ${t("panels.exclusive")}` : ""}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{p.roles.map((r) => roleName(r.roleId)).join(", ")}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditing({ panel: p })}>
                      {t("panels.edit")}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRemoving(p)}>
                      {t("panels.delete")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add / edit. Mounted only while open and keyed by panel, so it always starts from fresh values. */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.panel ? t("panel.editTitle") : t("panel.newTitle")}</DialogTitle>
            <DialogDescription>{t("panel.safety")}</DialogDescription>
          </DialogHeader>
          {editing && (
            <PanelForm
              key={editing.panel?.id ?? "new"}
              panel={editing.panel}
              channels={channels}
              roles={roles}
              emojis={emojis}
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
            <DialogTitle>{t("panels.confirmTitle")}</DialogTitle>
            <DialogDescription>{removing?.messageId ? t("panels.confirmBodyPosted") : t("panels.confirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("panel.cancel")}</DialogClose>
            <Button variant="destructive" disabled={pending} onClick={confirmRemove}>
              {t("panels.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
