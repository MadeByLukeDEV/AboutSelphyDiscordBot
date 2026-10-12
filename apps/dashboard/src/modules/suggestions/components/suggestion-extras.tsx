"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { GitMerge, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MAX_NOTE } from "@aboutselphy/shared/suggestions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addSuggestionNoteAction, mergeSuggestionAction, removeSuggestionNoteAction } from "../actions";
import type { SuggestionNote, SuggestionRow } from "../schema";

/** Private team notes on a suggestion, and (while it is open) closing it as a duplicate of another. */
export function SuggestionExtras({ row }: { row: SuggestionRow }) {
  const t = useTranslations("Suggestions.extras");
  const te = useTranslations("Suggestions.errors");
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<SuggestionNote[]>(row.notes);
  const [body, setBody] = useState("");
  const [target, setTarget] = useState("");

  function addNote() {
    startTransition(async () => {
      const result = await addSuggestionNoteAction({ suggestionId: row.id, body });
      if (result.ok) {
        setNotes(result.notes);
        setBody("");
      } else {
        toast.error(te(result.error));
      }
    });
  }

  function removeNote(id: string) {
    startTransition(async () => {
      const result = await removeSuggestionNoteAction({ id });
      if (result.ok) setNotes(result.notes);
      else toast.error(te(result.error));
    });
  }

  function merge() {
    const targetNumber = Number(target.replace(/^#/, ""));
    if (!Number.isInteger(targetNumber) || targetNumber < 1) return void toast.error(t("badNumber"));
    startTransition(async () => {
      const result = await mergeSuggestionAction({ id: row.id, targetNumber });
      if (result.ok) {
        toast.success(t("merged", { number: targetNumber }));
        setTarget("");
        router.refresh();
      } else {
        toast.error(te(result.error));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {row.mergedInto !== null && <p className="text-sm text-muted-foreground">{t("mergedInto", { number: row.mergedInto })}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <MessageSquare aria-hidden />
          {t("notes", { count: notes.length })}
        </Button>
        {row.status === "open" && (
          <div className="flex items-center gap-2">
            <Input aria-label={t("mergeLabel")} placeholder={t("mergePlaceholder")} inputMode="numeric" className="h-8 w-28" maxLength={8} value={target} onChange={(e) => setTarget(e.target.value)} />
            <Button type="button" size="sm" variant="outline" disabled={pending || target.trim() === ""} onClick={merge}>
              <GitMerge aria-hidden />
              {t("merge")}
            </Button>
          </div>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">{t("private")}</p>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    {/* Plain text: React escapes it. */}
                    <p className="break-words whitespace-pre-wrap">{n.body}</p>
                    <p className="text-xs text-muted-foreground">
                      {n.authorName} · {format.dateTime(new Date(n.createdAt), { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={t("removeNote")} disabled={pending} onClick={() => removeNote(n.id)}>
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Textarea aria-label={t("noteLabel")} rows={2} maxLength={MAX_NOTE} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("notePlaceholder")} />
          <div>
            <Button type="button" size="sm" disabled={pending || body.trim() === ""} onClick={addNote}>
              {t("addNote")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
