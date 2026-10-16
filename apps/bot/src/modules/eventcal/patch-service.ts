import { EmbedBuilder, type Guild } from "discord.js";
import { env } from "../../lib/env";
import { chatJson, aiConfigured } from "../../lib/ai";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { fetchPage } from "./fetcher";
import { htmlToText } from "./html-text";
import { findPatchLinks, parsePatchSummary, PATCH_SYSTEM_PROMPT, planPatches, plainExcerpt, type PatchLink } from "./patches";
import { claimPatch, listPatchUrls, rememberPatches, savePatchState, setPatchMessage, unclaimPatch, type SourceState } from "./repository";

// Announces a game's new patch notes. The list page is read at most every 25 minutes; the first successful look only remembers what is there
// (nothing old is announced). A patch note is claimed in the database BEFORE it is posted, so a restart or a second check can't post it twice;
// if posting fails the claim is given back and the next look tries again.

const MIN_GAP_MS = 25 * 60_000;
const accentNumber = (hex: string): number => Number.parseInt(hex.replace("#", ""), 16) || 0x00ffa8;
const SNOWFLAKE = /^\d{15,25}$/;

/** Short bullets for the page text: from the AI when it is set up and answers, else the first sentences of the page. */
async function bulletsFor(game: string, link: PatchLink, text: string): Promise<{ lines: string[]; ai: boolean }> {
  if (aiConfigured() && text.length > 200) {
    const answer = await chatJson(PATCH_SYSTEM_PROMPT, `Game: ${game}\nTitle: ${link.title}\n\n${text.slice(0, 12_000)}`, { maxTokens: 600, timeoutMs: 60_000 }).catch(() => null);
    const bullets = parsePatchSummary(answer);
    if (bullets) return { lines: bullets, ai: true };
  }
  return { lines: text ? [plainExcerpt(text)] : [], ai: false };
}

async function postPatch(guild: Guild, src: SourceState, link: PatchLink): Promise<boolean> {
  const channelId = src.patchChannelId;
  if (!channelId) return false;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.isDMBased() || channel.guildId !== env().DISCORD_GUILD_ID || !channel.isTextBased() || !("send" in channel)) return false;

  const page = await fetchPage(link.url, src.fetchMode).catch(() => null);
  const text = page && page.ok ? htmlToText(page.html, src.contentSelector).slice(0, 12_000) : "";
  const { lines, ai } = await bulletsFor(src.name, link, text);
  const description = lines.map((l) => (lines.length > 1 ? `• ${escapeText(l)}` : escapeText(l))).join("\n");
  const embed = new EmbedBuilder()
    .setColor(accentNumber(src.accentColor))
    .setTitle(truncate(escapeText(link.title), 250))
    .setURL(link.url)
    .setFooter({ text: ai ? `${src.name} · summary by AI` : src.name });
  if (description) embed.setDescription(truncate(description, 1800));
  const role = src.patchPingRoleId && SNOWFLAKE.test(src.patchPingRoleId) ? src.patchPingRoleId : null;
  const message = await channel.send({ ...(role ? { content: `<@&${role}>` } : {}), embeds: [embed], allowedMentions: { parse: [], roles: role ? [role] : [] } });
  await setPatchMessage(src.id, link.url, message.id);
  return true;
}

/** One look at a game's patch note list. Returns a short status code for the dashboard. Never throws. */
export async function checkPatchNotes(guild: Guild, src: SourceState, force = false): Promise<string> {
  if (!src.patchListUrl || !src.patchChannelId) return "off";
  if (!force && src.patchCheckedAt && Date.now() - src.patchCheckedAt.getTime() < MIN_GAP_MS) return "wait";
  const finish = async (status: string, baselined?: boolean): Promise<string> => {
    await savePatchState(src.id, { patchCheckedAt: new Date(), patchStatus: status, ...(baselined ? { patchBaselined: true } : {}) }).catch((err) => log.warn({ err }, "patchnotes: could not record the result"));
    if (status !== "ok") log.warn({ source: src.name, status }, "patchnotes: the look did not succeed");
    return status;
  };
  try {
    const page = await fetchPage(src.patchListUrl, src.fetchMode);
    if (!page.ok) return await finish(page.status === "notPublished" ? "notFound" : page.status);
    const found = findPatchLinks(page.html, src.patchListUrl);
    // A page without any patch-like link says nothing (a layout change or a script-only page): never baseline on it.
    if (found.length === 0) return await finish("noLinks");
    const plan = planPatches(found, await listPatchUrls(src.id), src.patchBaselined);
    if (plan.remember.length > 0) await rememberPatches(src.id, plan.remember);
    let posted = 0;
    for (const link of plan.post) {
      if (!(await claimPatch(src.id, link))) continue;
      const ok = await postPatch(guild, src, link).catch((err) => {
        log.error({ err, source: src.name }, "patchnotes: posting failed");
        return false;
      });
      if (ok) posted++;
      else await unclaimPatch(src.id, link.url).catch(() => undefined);
    }
    log.info({ source: src.name, found: found.length, posted, remembered: plan.remember.length }, "patchnotes: look done");
    return await finish("ok", !src.patchBaselined);
  } catch (err) {
    log.error({ err, source: src.name }, "patchnotes: a look failed");
    return await finish("failed");
  }
}
