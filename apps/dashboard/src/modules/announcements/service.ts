import "server-only";
import type { Announcement } from "@aboutselphy/db";
import type { AnnouncementInput } from "@aboutselphy/shared/announcement";
import { errorInfo } from "@/lib/log";
import { deleteAnnouncementMessage, editAnnouncementMessage, listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import type { StaffSession } from "@/modules/auth";
import {
  createAnnouncement,
  deleteAnnouncementRow,
  findAnnouncement,
  listAnnouncements,
  updateAnnouncement,
  type AnnouncementData,
} from "./repository";
import type { AnnouncementError, AnnouncementView, DeleteAnnouncementResult, SaveAnnouncementResult } from "./schema";

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
  scheduledFor: a.scheduledFor?.toISOString() ?? null,
  sentAt: a.sentAt?.toISOString() ?? null,
  lastError: a.lastError,
  createdByName: a.createdByName,
  createdAt: a.createdAt.toISOString(),
});

/** The list plus the channels and roles to pick from (null = the bot can't be reached). */
export async function getAnnouncementsPage() {
  const [rows, channels, roles] = await Promise.all([listAnnouncements(), listChannels(["text"]), listRoles()]);
  return { announcements: rows.map(toView), channels, roles };
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
    };

    // What the row becomes. A sent announcement stays sent (it is edited in Discord).
    let data: AnnouncementData;
    if (wasSent) {
      data = { ...fields, status: "sent", scheduledFor: existing.scheduledFor };
    } else if (input.mode === "draft") {
      data = { ...fields, status: "draft", scheduledFor: null };
    } else {
      const when = input.mode === "now" ? new Date() : new Date(input.scheduledFor!);
      data = { ...fields, status: "scheduled", scheduledFor: when };
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
