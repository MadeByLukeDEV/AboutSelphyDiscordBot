import type { Guild, Message } from "discord.js";
import type { MemberOverviewPayload, MemberOverviewPostResponse } from "@aboutselphy/shared/memberoverview";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { readOverview, setPosted } from "./repository";
import { overviewPages } from "./rules";

// The member overview in Discord. It only runs on request from the dashboard (an admin presses "post"): it never posts by itself.
// A later post edits the messages it posted before, so the link to the overview stays the same.

const mutex = new KeyedMutex();

export function postMemberOverview(guild: Guild, payload: MemberOverviewPayload): Promise<MemberOverviewPostResponse> {
  return mutex.run("overview", async (): Promise<MemberOverviewPostResponse> => {
    const config = await readOverview();
    if (!config.channelId) return { status: "noChannel", messages: 0 };
    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel || channel.isDMBased() || !channel.isTextBased() || !("send" in channel)) {
      log.warn({ channelId: config.channelId }, "memberoverview: the channel is missing or the bot can't post in it");
      return { status: "channel", messages: 0 };
    }
    try {
      const pages = overviewPages(payload, config.color);
      const kept: string[] = [];
      for (const [n, embeds] of pages.entries()) {
        const body = { embeds, allowedMentions: { parse: [] as never[] } };
        const old: Message | null = config.messageIds[n] ? await channel.messages.fetch(config.messageIds[n]).catch(() => null) : null;
        const message = old ? await old.edit({ content: "", ...body }) : await channel.send(body);
        kept.push(message.id);
      }
      for (const id of config.messageIds.slice(pages.length)) await channel.messages.delete(id).catch(() => undefined);
      await setPosted(kept);
      log.info({ channelId: channel.id, messages: kept.length }, "memberoverview: posted");
      return { status: "done", messages: kept.length };
    } catch (err) {
      log.warn({ err }, "memberoverview: could not post");
      return { status: "failed", messages: 0 };
    }
  });
}
