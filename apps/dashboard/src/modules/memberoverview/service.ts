import "server-only";
import { getTranslations } from "next-intl/server";
import type { MemberOverview } from "@aboutselphy/db";
import { FEATURE_GROUPS } from "@aboutselphy/shared/features";
import { memberOverviewPayload, type MemberOverviewInput, type MemberOverviewPayload, type OverviewLanguage } from "@aboutselphy/shared/memberoverview";
import { siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { listChannels, postMemberOverviewViaBot } from "@/modules/bot-api";
import { forgetMessages, readOverview, updateOverview } from "./repository";
import type { MemberOverviewPageData, PostMemberOverviewResult, SaveMemberOverviewResult } from "./schema";

const toSettings = (o: MemberOverview): MemberOverviewInput => ({ channelId: o.channelId ?? "", language: o.language === "de" ? "de" : "en", color: o.color });

export async function getMemberOverviewPage(): Promise<MemberOverviewPageData & { channels: Awaited<ReturnType<typeof listChannels>> }> {
  const [overview, channels] = await Promise.all([readOverview(), listChannels(["text"])]);
  return { settings: toSettings(overview), postedAt: overview.postedAt?.toISOString() ?? null, channels };
}

/** The text of the public /features page in one language, as the payload the bot posts. Built from the same catalogs and list as the page. */
export async function buildPayload(locale: OverviewLanguage): Promise<MemberOverviewPayload | null> {
  const t = await getTranslations({ locale, namespace: "Features" });
  const key = (k: string) => t(k as never);
  const payload = {
    title: key("title"),
    intro: key("intro"),
    url: `${siteUrl()}/features`,
    footer: key("footer"),
    groups: FEATURE_GROUPS.map((g) => ({
      title: key(`groups.${g.id}.title`),
      intro: key(`groups.${g.id}.intro`),
      items: g.items.map((i) => ({ title: key(`items.${i.key}.title`), body: key(`items.${i.key}.body`), commands: [...i.commands] })),
    })),
  };
  const parsed = memberOverviewPayload.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/** Saves channel, language and colour. A new channel must be a text channel of the server (checked through the bot; refused if it can't answer). */
export async function saveMemberOverview(input: MemberOverviewInput): Promise<SaveMemberOverviewResult> {
  try {
    const current = await readOverview();
    if (input.channelId && input.channelId !== current.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    // A different channel means the old messages are somewhere else: post fresh ones there (the old ones stay as they are).
    const moved = (current.channelId ?? "") !== input.channelId;
    const saved = await updateOverview({ ...input, channelId: input.channelId || null });
    if (moved) await forgetMessages();
    return { ok: true, settings: toSettings(saved) };
  } catch (error) {
    console.error("[memberoverview] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Saves nothing: builds the text in the saved language and asks the bot to post or update it. */
export async function postMemberOverview(): Promise<PostMemberOverviewResult> {
  try {
    const overview = await readOverview();
    if (!overview.channelId) return { ok: false, error: "needsChannel" };
    const payload = await buildPayload(overview.language === "de" ? "de" : "en");
    if (!payload) return { ok: false, error: "failed" };
    const result = await postMemberOverviewViaBot(payload);
    if (!result) return { ok: false, error: "botUnavailable" };
    if (result.status === "done") return { ok: true, messages: result.messages };
    if (result.status === "channel") return { ok: false, error: "channelNotUsable" };
    return { ok: false, error: result.status === "noChannel" ? "needsChannel" : "failed" };
  } catch (error) {
    console.error("[memberoverview] posting failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
