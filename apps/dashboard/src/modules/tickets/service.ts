import "server-only";
import type { TicketConfig } from "@aboutselphy/db";
import { transcriptSchema, type TicketCategoryInput, type TicketSettings, type Transcript } from "@aboutselphy/shared/tickets";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, postTicketPanel, reloadBotModule } from "@/modules/bot-api";
import { findByNumber, listCategories, listTickets, ratingStats, readConfig, replaceCategories, updateConfig } from "./repository";
import type { PanelResult, SaveCategoriesResult, SaveTicketsResult, TicketRow } from "./schema";

const toSettings = (c: TicketConfig): TicketSettings => ({
  enabled: c.enabled,
  panelChannelId: c.panelChannelId ?? "",
  categoryId: c.categoryId ?? "",
  logChannelId: c.logChannelId ?? "",
  staffRoleIds: c.staffRoleIds,
  maxOpenPerUser: c.maxOpenPerUser,
  askReason: c.askReason,
  askRating: c.askRating,
  autoCloseHours: c.autoCloseHours,
  panelTitle: c.panelTitle,
  panelDescription: c.panelDescription,
  panelColor: c.panelColor,
  buttonLabel: c.buttonLabel,
  welcomeTemplate: c.welcomeTemplate,
});

/** Settings, the panel's state, the tickets, and the channels and roles to pick from (null = bot unreachable). */
export async function getTicketsPage() {
  const [config, tickets, channels, roles] = await Promise.all([readConfig(), listTickets(50), listChannels(["text", "category"]), listRoles()]);
  const rows: TicketRow[] = tickets.map((t) => ({
    id: t.id,
    number: t.number,
    status: t.status,
    openerId: t.openerId,
    openerName: t.openerName,
    claimedByName: t.claimedByName,
    createdAt: t.createdAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    closedByName: t.closedByName,
    messageCount: t.messageCount,
    hasTranscript: t.hasTranscript,
    categoryLabel: t.categoryLabel,
    rating: t.rating,
  }));
  const [cats, ratings] = await Promise.all([listCategories(), ratingStats()]);
  const categories: TicketCategoryInput[] = cats.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji, discordCategoryId: c.discordCategoryId ?? "", staffRoleIds: c.staffRoleIds }));
  return { settings: toSettings(config), panelPosted: config.panelMessageId !== null, tickets: rows, channels, roles, categories, ratings };
}

export type TicketDetail = {
  number: number;
  status: "open" | "closed";
  openerId: string;
  openerName: string;
  claimedByName: string | null;
  createdAt: string;
  closedAt: string | null;
  closedByName: string | null;
  closeReason: string;
  categoryLabel: string;
  topic: string;
  rating: number | null;
  /** null = no transcript was saved (the bot couldn't read message text, or the ticket is still open). */
  transcript: Transcript | null;
};

export async function getTicketDetail(number: number): Promise<TicketDetail | null> {
  const t = await findByNumber(number);
  if (!t) return null;
  // The stored JSON is parsed again here: whatever is in the column, only a valid transcript is shown.
  const parsed = t.transcript === null ? null : transcriptSchema.safeParse(t.transcript);
  return {
    number: t.number,
    status: t.status,
    openerId: t.openerId,
    openerName: t.openerName,
    claimedByName: t.claimedByName,
    createdAt: t.createdAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    closedByName: t.closedByName,
    closeReason: t.closeReason,
    categoryLabel: t.categoryLabel,
    topic: t.topic,
    rating: t.rating,
    transcript: parsed?.success ? parsed.data : null,
  };
}

/**
 * Saves the settings. New channels, the category and staff roles are checked against the server through
 * the bot (refused if it can't answer); saved ones need no lookup, so switching tickets off still works
 * while the bot is down.
 */
export async function saveTickets(input: TicketSettings): Promise<SaveTicketsResult> {
  try {
    const current = toSettings(await readConfig());
    const newChannels = [input.panelChannelId, input.logChannelId].filter((id) => id && id !== current.panelChannelId && id !== current.logChannelId);
    const newCategory = input.categoryId && input.categoryId !== current.categoryId ? input.categoryId : null;
    const newRoles = input.staffRoleIds.filter((id) => !current.staffRoleIds.includes(id));

    if (newChannels.length > 0 || newCategory) {
      const channels = await listChannels(["text", "category"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (newChannels.some((id) => !channels.some((c) => c.id === id && c.kind === "text"))) return { ok: false, error: "channelNotFound" };
      if (newCategory && !channels.some((c) => c.id === newCategory && c.kind === "category")) return { ok: false, error: "categoryNotFound" };
    }
    if (newRoles.length > 0) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      if (newRoles.some((id) => !roles.some((r) => r.id === id))) return { ok: false, error: "roleNotFound" };
    }

    const saved = await updateConfig({
      enabled: input.enabled,
      panelChannelId: input.panelChannelId || null,
      categoryId: input.categoryId || null,
      logChannelId: input.logChannelId || null,
      staffRoleIds: input.staffRoleIds,
      maxOpenPerUser: input.maxOpenPerUser,
      askReason: input.askReason,
      askRating: input.askRating,
      autoCloseHours: input.autoCloseHours,
      panelTitle: input.panelTitle,
      panelDescription: input.panelDescription,
      panelColor: input.panelColor,
      buttonLabel: input.buttonLabel,
      welcomeTemplate: input.welcomeTemplate,
    });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("tickets") };
  } catch (error) {
    console.error("[tickets] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Asks the bot to post the panel (or update it, after a settings change). */
export async function publishPanel(): Promise<PanelResult> {
  const status = await postTicketPanel();
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "posted" || status === "updated") return { ok: true, status };
  return { ok: false, error: status };
}

/**
 * Saves the ticket types. A Discord category and the staff roles of a type are checked against the server through the bot
 * (refused if it can't answer); an id that isn't one of ours is refused, so a crafted request can't touch another row.
 */
export async function saveCategories(input: TicketCategoryInput[]): Promise<SaveCategoriesResult> {
  try {
    const existing = await listCategories();
    if (input.some((c) => c.id && !existing.some((e) => e.id === c.id))) return { ok: false, error: "notFound" };
    const newParents = input.flatMap((c) => (c.discordCategoryId && !existing.some((e) => e.id === c.id && e.discordCategoryId === c.discordCategoryId) ? [c.discordCategoryId] : []));
    const newRoles = input.flatMap((c) => c.staffRoleIds.filter((id) => !existing.some((e) => e.id === c.id && e.staffRoleIds.includes(id))));
    if (newParents.length > 0) {
      const channels = await listChannels(["category"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (newParents.some((id) => !channels.some((c) => c.id === id && c.kind === "category"))) return { ok: false, error: "categoryNotFound" };
    }
    if (newRoles.length > 0) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      if (newRoles.some((id) => !roles.some((r) => r.id === id))) return { ok: false, error: "roleNotFound" };
    }
    await replaceCategories(input.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji, discordCategoryId: c.discordCategoryId || null, staffRoleIds: c.staffRoleIds })));
    const saved = await listCategories();
    return { ok: true, categories: saved.map((c) => ({ id: c.id, label: c.label, emoji: c.emoji, discordCategoryId: c.discordCategoryId ?? "", staffRoleIds: c.staffRoleIds })), botNotified: await reloadBotModule("tickets") };
  } catch (error) {
    console.error("[tickets] saving the categories failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
