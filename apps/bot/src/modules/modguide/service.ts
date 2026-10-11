import type { Guild, Message } from "discord.js";
import type { ModGuidePostResponse, ModGuidePreview } from "@aboutselphy/shared";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { buildCategories, buildGuidePages, type GuideCommand } from "./rules";
import { readGuide, setPosted } from "./repository";

// The moderators' guide. The command list is read from the registered commands when the guide is posted
// (never copied by hand), so a new moderator command shows up the next time an admin presses "post".
// It only runs on request from the dashboard: it never posts by itself.

const mutex = new KeyedMutex();

async function commands(): Promise<GuideCommand[]> {
  const { COMMANDS } = await import("../../commands/index"); // lazy: that list is built from the modules
  return COMMANDS;
}

/** What the guide would list, for the dashboard's preview. */
export async function guidePreview(): Promise<ModGuidePreview> {
  return { categories: buildCategories(await commands()) };
}

/** Posts the guide, or edits the messages it posted before, so the link to it stays the same. */
export function postGuide(guild: Guild): Promise<ModGuidePostResponse> {
  return mutex.run("guide", async (): Promise<ModGuidePostResponse> => {
    const config = await readGuide();
    if (!config.channelId) return { status: "noChannel", messages: 0 };
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel || channel.isDMBased() || !channel.isTextBased() || !("send" in channel)) {
      log.warn({ channelId: config.channelId }, "modguide: the channel is missing or the bot can't post in it");
      return { status: "channel", messages: 0 };
    }
    try {
      const pages = buildGuidePages(config, buildCategories(await commands()));
      const kept: string[] = [];
      for (const [n, embeds] of pages.entries()) {
        const payload = { embeds, allowedMentions: { parse: [] as never[] } };
        const old: Message | null = config.messageIds[n] ? await channel.messages.fetch(config.messageIds[n]).catch(() => null) : null;
        const message = old ? await old.edit({ content: "", ...payload }) : await channel.send(payload);
        kept.push(message.id);
      }
      for (const id of config.messageIds.slice(pages.length)) await channel.messages.delete(id).catch(() => undefined);
      await setPosted(kept);
      log.info({ channelId: channel.id, messages: kept.length }, "modguide: posted");
      return { status: "done", messages: kept.length };
    } catch (err) {
      log.warn({ err }, "modguide: could not post");
      return { status: "failed", messages: 0 };
    }
  });
}
