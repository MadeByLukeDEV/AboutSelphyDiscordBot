import type { Client } from "discord.js";
import { env } from "../../lib/env";
import { escapeText, truncate } from "../../lib/escape";
import { log } from "../../lib/log";
import { getClips, TwitchError, type TwitchClip } from "./helix";
import { knownClipIds, listStreamers, pruneClips, readConfig, rememberClip, setClipsChecked } from "./repository";
import { getAccessToken, NoTwitchToken, twitchCredentials } from "./tokens";

// New Twitch clips of the announced channels, posted to one Discord channel. A round every 5 minutes asks Helix for clips made since
// the last check (with an overlap, because Twitch lists a clip a little after it is made) and posts the ones it hasn't seen.
// A channel's first check only remembers what exists (never an announcement from a fresh switch), every clip is remembered
// BEFORE it is posted (a restart or a second round can't post it twice), and one round posts at most three clips per channel.

const ROUND_EVERY_MS = 5 * 60_000;
const OVERLAP_MS = 10 * 60_000;
const MAX_AGE_MS = 6 * 3_600_000;
export const MAX_CLIPS_PER_ROUND = 3;
const KEEP_MS = 14 * 86_400_000;

export type ClipPlan = { post: TwitchClip[]; remember: string[] };

/**
 * What to do with the clips Helix returned. First check (no `checkedAt`): remember everything, post nothing. Later: post unseen clips
 * made after the previous check (minus the overlap) and not older than six hours, oldest first, at most `max`; the rest of the
 * unseen ones are remembered silently so they don't come back as a late flood.
 */
export function planClips(clips: readonly TwitchClip[], known: ReadonlySet<string>, checkedAt: Date | null, now: Date, max = MAX_CLIPS_PER_ROUND, minViews = 0): ClipPlan {
  const unseen = clips.filter((c) => !known.has(c.id));
  if (checkedAt === null) return { post: [], remember: unseen.map((c) => c.id) };
  // With a view limit, a young clip may still be climbing: look at everything of the last six hours every round.
  const since = minViews > 0 ? now.getTime() - MAX_AGE_MS : Math.max(checkedAt.getTime() - OVERLAP_MS, now.getTime() - MAX_AGE_MS);
  const fresh = unseen.filter((c) => c.createdAt.getTime() >= since).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  // A clip still below the view limit is neither posted nor remembered while it is young enough to catch up: a later round looks again.
  const eligible = fresh.filter((c) => c.viewCount >= minViews);
  const waiting = new Set(fresh.filter((c) => c.viewCount < minViews).map((c) => c.id));
  const post = eligible.slice(0, max);
  const posted = new Set(post.map((c) => c.id));
  return { post, remember: unseen.filter((c) => !posted.has(c.id) && !waiting.has(c.id)).map((c) => c.id) };
}

/** Only a clip page on Twitch itself is ever linked. */
export const isTwitchClipUrl = (url: string): boolean => /^https:\/\/(www\.|clips\.)?twitch\.tv\/[A-Za-z0-9_\-/]+$/.test(url);

/** The Discord message for a clip. Names and the title are escaped; the link makes Discord show the player; nothing pings. */
export function clipMessage(clip: TwitchClip, streamerName: string): string | null {
  if (!isTwitchClipUrl(clip.url)) return null;
  const creator = clip.creatorName ? ` · clipped by ${escapeText(truncate(clip.creatorName, 40))}` : "";
  return `🎬 **New clip from ${escapeText(truncate(streamerName, 40))}**: ${escapeText(truncate(clip.title, 120))}${creator}\n${clip.url}`;
}

let lastRound = 0;
let running = false;

/** Called by the minute timer; does its work once per ROUND_EVERY_MS. Never throws. */
export async function clipsRound(client: Client): Promise<void> {
  if (running || Date.now() - lastRound < ROUND_EVERY_MS) return;
  running = true;
  lastRound = Date.now();
  try {
    const config = await readConfig();
    if (!config.enabled || !config.clipsChannelId) return;
    const streamers = (await listStreamers()).filter((s) => s.enabled && s.postClips);
    if (streamers.length === 0) return;
    const credentials = twitchCredentials();
    if (!credentials) return;
    let token: string;
    try {
      token = await getAccessToken();
    } catch (err) {
      if (err instanceof NoTwitchToken) return; // nothing changes until someone connects
      throw err;
    }
    const channel = await client.channels.fetch(config.clipsChannelId).catch(() => null);
    if (!channel || channel.isDMBased() || channel.guildId !== env().DISCORD_GUILD_ID || !channel.isTextBased() || !("send" in channel)) {
      return void log.warn({ channelId: config.clipsChannelId }, "twitch clips: the channel is missing or not a text channel");
    }

    for (const streamer of streamers) {
      const startedAt = new Date();
      try {
        const since = streamer.clipsCheckedAt ? new Date(config.clipsMinViews > 0 ? startedAt.getTime() - MAX_AGE_MS : streamer.clipsCheckedAt.getTime() - OVERLAP_MS) : new Date(startedAt.getTime() - 24 * 3_600_000);
        const clips = await getClips(credentials, token, streamer.twitchUserId, since);
        const known = await knownClipIds(clips.map((c) => c.id));
        const plan = planClips(clips, known, streamer.clipsCheckedAt, startedAt, MAX_CLIPS_PER_ROUND, config.clipsMinViews);
        for (const id of plan.remember) await rememberClip(id, streamer.twitchUserId);
        for (const clip of plan.post) {
          if (!(await rememberClip(clip.id, streamer.twitchUserId))) continue; // someone else posted it
          const text = clipMessage(clip, streamer.displayName);
          if (!text) {
            log.warn({ clip: clip.id }, "twitch clips: unexpected clip address, skipped");
            continue;
          }
          await channel.send({ content: text, allowedMentions: { parse: [] } });
          log.info({ clip: clip.id, streamer: streamer.login }, "twitch clips: posted");
        }
        await setClipsChecked(streamer.id, startedAt);
        if (streamer.clipsCheckedAt === null) log.info({ streamer: streamer.login, remembered: plan.remember.length }, "twitch clips: first check, nothing announced");
      } catch (err) {
        if (err instanceof TwitchError && err.code === "rateLimited") return void log.warn({}, "twitch clips: rate limited, trying again next round");
        log.error({ err, streamer: streamer.login }, "twitch clips: checking a channel failed");
      }
    }
    await pruneClips(new Date(Date.now() - KEEP_MS));
  } catch (err) {
    log.error({ err }, "twitch clips: round failed");
  } finally {
    running = false;
  }
}
