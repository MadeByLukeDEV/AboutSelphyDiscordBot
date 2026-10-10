import "server-only";
import type { WelcomeConfig } from "@aboutselphy/db";
import type { WelcomeSettings } from "@aboutselphy/shared/welcome";
import { errorInfo } from "@/lib/log";
import { listChannels, listRoles, reloadBotModule } from "@/modules/bot-api";
import { cardImageProblem, readImageInfo } from "@aboutselphy/shared/image-info";
import { deleteCardImage, readCardImage, readConfig, saveCardImage, updateConfig } from "./repository";
import type { CardImageResult, CardImageView, SaveWelcomeResult } from "./schema";

const toSettings = (c: WelcomeConfig): WelcomeSettings => ({
  autoRoleIds: c.autoRoleIds,
  botAutoRoleIds: c.botAutoRoleIds,
  restoreRoles: c.restoreRoles,
  welcomeEnabled: c.welcomeEnabled,
  welcomeChannelId: c.welcomeChannelId ?? "",
  welcomeTemplates: c.welcomeTemplates,
  welcomeCardEnabled: c.welcomeCardEnabled,
  welcomeCardMode: c.welcomeCardMode === "sticker" ? "sticker" : "background",
  welcomeCardTitle: c.welcomeCardTitle,
  welcomeCardSubtitle: c.welcomeCardSubtitle,
  welcomeAsEmbed: c.welcomeAsEmbed,
  welcomeColor: c.welcomeColor,
  welcomeImageUrl: c.welcomeImageUrl,
  dmEnabled: c.dmEnabled,
  dmTemplate: c.dmTemplate,
  goodbyeEnabled: c.goodbyeEnabled,
  goodbyeChannelId: c.goodbyeChannelId ?? "",
  goodbyeTemplate: c.goodbyeTemplate,
});

/** The settings plus the channels and roles to pick from (null = the bot can't be reached). */
export async function getWelcomePage() {
  const [config, channels, roles, image] = await Promise.all([readConfig(), listChannels(["text"]), listRoles(), readCardImage()]);
  const cardImage: CardImageView | null = image
    ? { contentType: image.contentType, width: image.width, height: image.height, uploadedByName: image.uploadedByName, uploadedAt: image.uploadedAt.toISOString() }
    : null;
  return { settings: toSettings(config), channels, roles, cardImage };
}

/** The stored picture's bytes and type, for the admin-only route that shows it. */
export async function getCardImageFile(): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const row = await readCardImage();
  return row ? { bytes: new Uint8Array(row.data), contentType: row.contentType } : null;
}

/**
 * Stores the picture for the welcome card. The file is only trusted after its own first bytes
 * have been read: it must really be a PNG, JPEG or WebP, at most 3 MB and between 64 and 4096
 * pixels a side. The type is taken from those bytes, never from the file name or the browser.
 */
export async function setCardImage(file: Uint8Array, by: string): Promise<CardImageResult> {
  try {
    const problem = cardImageProblem(file);
    if (problem) return { ok: false, error: problem };
    const info = readImageInfo(file)!;
    const saved = await saveCardImage({ data: new Uint8Array(file), contentType: info.type, width: info.width, height: info.height, uploadedByName: by });
    return { ok: true, image: { contentType: saved.contentType, width: saved.width, height: saved.height, uploadedByName: saved.uploadedByName, uploadedAt: saved.uploadedAt.toISOString() } };
  } catch (error) {
    console.error("[welcome] storing the card picture failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function clearCardImage(): Promise<CardImageResult> {
  try {
    await deleteCardImage();
    return { ok: true, image: null };
  } catch (error) {
    console.error("[welcome] removing the card picture failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/**
 * Saves the settings. Channels must be text channels of the server, and every auto-role a
 * role the bot may hand out (its own list says so). A role or channel that is already saved
 * stays valid without a lookup, so a settings change still works while the bot is down; a new
 * one needs the bot to answer. The bot checks each role again every time someone joins.
 */
export async function saveWelcome(input: WelcomeSettings): Promise<SaveWelcomeResult> {
  try {
    const current = await readConfig();
    const newChannels = [input.welcomeChannelId, input.goodbyeChannelId].filter((id) => id && id !== current.welcomeChannelId && id !== current.goodbyeChannelId);
    const newRoles = [...input.autoRoleIds, ...input.botAutoRoleIds].filter((id) => !current.autoRoleIds.includes(id) && !current.botAutoRoleIds.includes(id));

    if (newChannels.length > 0) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (newChannels.some((id) => !channels.some((c) => c.id === id))) return { ok: false, error: "channelNotFound" };
    }
    if (newRoles.length > 0) {
      const roles = await listRoles();
      if (!roles) return { ok: false, error: "botUnavailable" };
      for (const id of newRoles) {
        const known = roles.find((r) => r.id === id);
        if (!known) return { ok: false, error: "roleNotFound" };
        if (!known.assignable) return { ok: false, error: "roleNotAllowed" };
      }
    }

    const saved = await updateConfig({
      autoRoleIds: input.autoRoleIds,
      botAutoRoleIds: input.botAutoRoleIds,
      restoreRoles: input.restoreRoles,
      welcomeEnabled: input.welcomeEnabled,
      welcomeChannelId: input.welcomeChannelId || null,
      welcomeTemplates: input.welcomeTemplates,
      welcomeCardEnabled: input.welcomeCardEnabled,
      welcomeCardMode: input.welcomeCardMode,
      welcomeCardTitle: input.welcomeCardTitle,
      welcomeCardSubtitle: input.welcomeCardSubtitle,
      welcomeAsEmbed: input.welcomeAsEmbed,
      welcomeColor: input.welcomeColor,
      welcomeImageUrl: input.welcomeImageUrl.trim(),
      dmEnabled: input.dmEnabled,
      dmTemplate: input.dmTemplate,
      goodbyeEnabled: input.goodbyeEnabled,
      goodbyeChannelId: input.goodbyeChannelId || null,
      goodbyeTemplate: input.goodbyeTemplate,
    });
    return { ok: true, settings: toSettings(saved), botNotified: await reloadBotModule("welcome") };
  } catch (error) {
    console.error("[welcome] saving the settings failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
