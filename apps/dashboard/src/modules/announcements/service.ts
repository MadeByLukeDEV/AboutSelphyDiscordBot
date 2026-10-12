import "server-only";
import type { Announcement } from "@aboutselphy/db";
import { MAX_TEMPLATES, type AnnouncementInput, type AnnouncementTemplateInput } from "@aboutselphy/shared/announcement";
import { errorInfo } from "@/lib/log";
import { deleteAnnouncementMessage, editAnnouncementMessage, listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import type { StaffSession } from "@/modules/auth";
import {
  countTemplates,
  createAnnouncement,
  deleteAnnouncementRow,
  deleteTemplate,
  findAnnouncement,
  listAnnouncements,
  listTemplates,
  templateNameTaken,
  updateAnnouncement,
  upsertTemplate,
  type AnnouncementData,
} from "./repository";
import type { AnnouncementError, AnnouncementView, DeleteAnnouncementResult, SaveAnnouncementResult, TemplateResult, TemplateView } from "./schema";

const toView = (a: Announcement): AnnouncementView => ({
  id: a.id,
  status: a.status,
  content: a.content,
  embedEnabled: a.embedEnabled,
  embedTitle: a.embedTitle,
  embedDescription: a.embedDescription,
  embedColor: a.embedColor,
  embedImageUrl: a.embedImageUrl,
  channelId: a.channelId,
  pingRoleId: a.pingRoleId ?? "",
  pingEveryone: a.pingEveryone,
  scheduledFor: a.scheduledFor?.toISOString() ?? null,
  repeat: a.repeat,
  repeatUntil: a.repeatUntil?.toISOString() ?? null,
  sentAt: a.sentAt?.toISOString() ?? null,
  lastError: a.lastError,
  createdByName: a.createdByName,
  createdAt: a.createdAt.toISOString(),
});

const toTemplateView = (t: Awaited<ReturnType<typeof listTemplates>>[number]): TemplateView => ({
  id: t.id,
  name: t.name,
  content: t.content,
  embedEnabled: t.embedEnabled,
  embedTitle: t.embedTitle,
  embedDescription: t.embedDescription,
  embedColor: t.embedColor,
  embedImageUrl: t.embedImageUrl,
  channelId: t.channelId ?? "",
  pingRoleId: t.pingRoleId ?? "",
});

/** The list plus the channels and roles to pick from (null = the bot can't be reached). */
export async function getAnnouncementsPage() {
  const [rows, channels, roles, templates] = await Promise.all([listAnnouncements(), listChannels(["text"]), listRoles(), listTemplates()]);
  return { announcements: rows.map(toView), channels, roles, templates: templates.map(toTemplateView) };
}

const fail = (error: AnnouncementError) => ({ ok: false as const, error });

/**
 * Creates (no id) or changes (with id) an announcement. Nothing from the request is
 * trusted: the channel must be a text channel of the server and the role a real role,
 * checked through the bot; when the bot can't answer, a change that needs the check
 * is refused. A sent announcement keeps its channel and is updated in Discord.
 */
export async function saveAnnouncement(input: AnnouncementInput, by: StaffSession["user"]): Promise<SaveAnnouncementResult> {
  try {
    const existing = input.id ? await findAnnouncement(input.id) : null;
    if (input.id && !existing) return fail("notFound");
    if (existing?.status === "sending") return fail("locked");
    const wasSent = existing?.status === "sent";
    if (wasSent && existing.channelId !== input.channelId) return fail("channelFixed");

    // @everyone reaches the whole server: only an admin may switch it on or off (a moderator can keep what an admin set).
    if (input.pingEveryone !== (existing?.pingEveryone ?? false) && by.role !== "admin") return fail("forbidden");
    const roleId = input.pingRoleId || null;
    // Only look things up when they changed (or are new).
    if (!existing || existing.channelId !== input.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return fail("botUnavailable");
      if (!channels.some((c) => c.id === input.channelId)) return fail("channelNotFound");
    }
    if (roleId && roleId !== (existing?.pingRoleId ?? null)) {
      const roles = await listRoles();
      if (!roles) return fail("botUnavailable");
      if (!roles.some((r) => r.id === roleId)) return fail("roleNotFound");
    }

    const fields = {
      content: input.content.trim(),
      embedEnabled: input.embedEnabled,
      embedTitle: input.embedTitle.trim(),
      embedDescription: input.embedDescription.trim(),
      embedColor: input.embedColor,
      embedImageUrl: input.embedImageUrl,
      channelId: input.channelId,
      pingRoleId: roleId,
      pingEveryone: input.pingEveryone,
    };

    // What the row becomes. A sent announcement stays sent (it is edited in Discord).
    let data: AnnouncementData;
    if (wasSent) {
      data = { ...fields, status: "sent", scheduledFor: existing.scheduledFor };
    } else if (input.mode === "draft") {
      data = { ...fields, status: "draft", scheduledFor: null, repeat: "none", repeatUntil: null };
    } else {
      const when = input.mode === "now" ? new Date() : new Date(input.scheduledFor!);
      const repeating = input.mode === "schedule" && input.repeat !== "none";
      data = { ...fields, status: "scheduled", scheduledFor: when, repeat: repeating ? input.repeat : "none", repeatUntil: repeating && input.repeatUntil ? new Date(input.repeatUntil) : null };
    }

    let saved: Announcement | null;
    if (existing) {
      saved = await updateAnnouncement(existing.id, data, wasSent ? ["sent"] : ["draft", "scheduled", "failed"]);
      if (!saved) return fail("locked"); // the bot took it between our read and the update
    } else {
      saved = await createAnnouncement(data, { userId: by.id, name: by.name });
    }

    // Nudge the bot when something is due right now; it also checks every 30 s.
    const botNotified = data.status === "scheduled" && input.mode === "now" ? await reloadBotModule("announcements") : true;
    const discordUpdated = wasSent ? (await editAnnouncementMessage(saved.id)) === "edited" : null;
    return { ok: true, announcement: toView(saved), botNotified, discordUpdated };
  } catch (error) {
    console.error("[announcements] saving failed", errorInfo(error));
    return fail("failed");
  }
}

/**
 * Deletes an announcement. A sent one is removed from Discord first; if Discord can't be
 * reached the row stays, so nothing is left on the server that the dashboard forgot about.
 */
export async function removeAnnouncement(id: string): Promise<DeleteAnnouncementResult> {
  try {
    const existing = await findAnnouncement(id);
    if (!existing) return fail("notFound");
    if (existing.status === "sending") return fail("locked");
    if (existing.status === "sent") {
      const status = await deleteAnnouncementMessage(id);
      if (status === null || status === "failed") return fail("botUnavailable");
    }
    return (await deleteAnnouncementRow(id)) ? { ok: true } : fail("locked");
  } catch (error) {
    console.error("[announcements] deleting failed", errorInfo(error));
    return fail("failed");
  }
}

/** Saves a template under its name (an existing one with that name is replaced). The channel and role are only suggestions: they are checked again when an announcement is saved. */
export async function saveTemplate(input: AnnouncementTemplateInput, byName: string): Promise<TemplateResult> {
  try {
    if (!(await templateNameTaken(input.name)) && (await countTemplates()) >= MAX_TEMPLATES) return fail("tooManyTemplates");
    await upsertTemplate(
      {
        name: input.name,
        content: input.content.trim(),
        embedEnabled: input.embedEnabled,
        embedTitle: input.embedTitle.trim(),
        embedDescription: input.embedDescription.trim(),
        embedColor: input.embedColor,
        embedImageUrl: input.embedImageUrl,
        channelId: input.channelId || null,
        pingRoleId: input.pingRoleId || null,
      },
      byName,
    );
    return { ok: true };
  } catch (error) {
    console.error("[announcements] saving a template failed", errorInfo(error));
    return fail("failed");
  }
}

export async function removeTemplate(id: string): Promise<TemplateResult> {
  try {
    return (await deleteTemplate(id)) ? { ok: true } : fail("notFound");
  } catch (error) {
    console.error("[announcements] removing a template failed", errorInfo(error));
    return fail("failed");
  }
}
