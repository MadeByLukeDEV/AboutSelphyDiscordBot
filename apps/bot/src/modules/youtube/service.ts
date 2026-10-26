import { Events, type Client } from "discord.js";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { latestUploadIds, videoDetails, YoutubeError } from "./api";
import { decideUploads, uploadsPlaylistId } from "./logic";
import { premiereMessage, videoMessage } from "./message";
import { adoptEnvChannel, enabledChannels, knownVideoIds, markChannelPolled, readConfig, recordPoll, rememberVideo } from "./repository";
import type { YoutubeChannel, YoutubeConfig } from "@aboutselphy/db";

// New video uploads. Every 5 minutes (and when the dashboard saves settings) the bot
// reads the channel's uploads playlist, which costs 1 quota unit, and for videos it
// hasn't seen asks for their details, another unit: about 600 of the free 10,000 units a
// day. A video is announced once (unique video id), the first run only remembers what is
// there, and a video that isn't public yet is looked at again next round.

const INTERVAL_MS = 5 * 60_000;

let discord: Client | undefined;
let running = false;

export type YoutubeRuntime = { active: boolean; inactiveReason?: "disabledInDev" | "notConfigured" };

export function youtubeRuntime(): YoutubeRuntime {
  if (!integrationsActive()) return { active: false, inactiveReason: "disabledInDev" };
  if (!env().YOUTUBE_API_KEY) return { active: false, inactiveReason: "notConfigured" };
  return { active: true };
}

/** One poll. Never throws; the outcome is stored for the dashboard as a short code. */
export async function pollUploads(): Promise<void> {
  if (running || !discord) return;
  running = true;
  try {
    const { YOUTUBE_API_KEY: apiKey, YOUTUBE_CHANNEL_ID: envChannel } = env();
    if (!apiKey) return;
    const config = await readConfig();
    await adoptEnvChannel(config, envChannel);
    const channels = await enabledChannels();
    if (channels.length === 0) {
      log.info({}, "youtube: no channels configured");
      return;
    }
    // One channel failing (renamed, deleted) must not stop the others; the dashboard shows the first code.
    let lastError = "";
    for (const channel of channels) {
      try {
        await pollChannel(apiKey, config, channel);
      } catch (err) {
        lastError ||= err instanceof YoutubeError ? err.code : "failed";
        log.error({ err: err instanceof YoutubeError ? { code: err.code, status: err.status } : err, channel: channel.ytChannelId }, "youtube: poll failed");
      }
    }
    await recordPoll(lastError ? null : new Date(), lastError);
  } catch (err) {
    log.error({ err }, "youtube: poll failed");
    await recordPoll(null, "failed").catch(() => undefined);
  } finally {
    running = false;
  }
}

async function pollChannel(apiKey: string, config: YoutubeConfig, channel: YoutubeChannel): Promise<void> {
  if (!discord) return;
  const playlistId = uploadsPlaylistId(channel.ytChannelId);
  if (!playlistId) return;
  // Polling continues while announcing is off, so switching it on never announces a backlog.
  const ids = await latestUploadIds(apiKey, playlistId);
  const known = await knownVideoIds(ids);
  const unseen = ids.filter((id) => !known.has(id));
  const details = await videoDetails(apiKey, unseen);
  const byId = new Map(details.map((d) => [d.videoId, d]));
  // A channel that was never looked at only remembers what is there (a newly added channel never announces its back catalogue).
  const firstRun = channel.seededAt === null;

  const decisions = decideUploads({
    videos: details,
    knownIds: known,
    firstRun,
    announceShorts: config.announceShorts,
    announcePremieres: config.announcePremieres,
    now: new Date(),
  });
  log.info(
    { channel: channel.ytChannelId, seen: ids.length, unseen: unseen.length, announce: decisions.filter((d) => d.action === "announce").length, firstRun },
    "youtube: polled",
  );

  let failed = false;
  for (const decision of decisions) {
    const video = byId.get(decision.videoId);
    if (!video || decision.action === "wait") continue;

    let messageId: string | null = null;
    let announcedAt: Date | null = null;
    if (decision.action === "announce" || decision.action === "premiere") {
      if (!config.enabled || !config.channelId) {
        log.info({ videoId: video.videoId }, "youtube: new video, announcing is off, remembered silently");
      } else {
        const target = await discord.channels.fetch(config.channelId).catch(() => null);
        if (!target || target.isDMBased() || target.guildId !== env().DISCORD_GUILD_ID || !target.isTextBased() || !("send" in target)) {
          log.warn({ channelId: config.channelId }, "youtube: announcement channel missing or not a text channel, will retry");
          failed = true;
          continue; // not remembered: the next round tries again
        }
        try {
          const message = await target.send(
            decision.action === "premiere"
              ? premiereMessage(video, config.premiereTemplate, config.pingRoleId, config.embedColor, config.showWatchButton)
              : videoMessage(video, config.messageTemplate, config.pingRoleId, config.embedColor, config.showWatchButton),
          );
          messageId = message.id;
          announcedAt = new Date();
          log.info({ videoId: video.videoId, channelId: config.channelId, messageId }, "youtube: announced");
        } catch (err) {
          log.error({ err, videoId: video.videoId }, "youtube: could not post, will retry");
          failed = true;
          continue;
        }
      }
    }
    await rememberVideo({
      videoId: video.videoId,
      title: video.title,
      publishedAt: video.publishedAt,
      isShort: decision.action === "premiere" ? false : decision.isShort,
      messageId,
      announcedAt,
    });
  }
  // Seeded only when every decision was handled, so a failed first look is repeated as a first look.
  if (!failed) await markChannelPolled(channel.id, details[0]?.channelTitle ?? null, channel.name !== "");
}

let timer: ReturnType<typeof setInterval> | undefined;

export function startYoutube(client: Client): void {
  discord = client;
  const runtime = youtubeRuntime();
  if (!runtime.active) {
    log.info({ reason: runtime.inactiveReason }, "youtube: not starting");
    return;
  }
  // The dashboard saved new settings: poll now instead of waiting for the next round.
  onReload("youtube", () => void pollUploads());
  client.once(Events.ClientReady, () => {
    void pollUploads();
    timer = setInterval(() => void pollUploads(), INTERVAL_MS);
  });
}

export function stopYoutube(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
