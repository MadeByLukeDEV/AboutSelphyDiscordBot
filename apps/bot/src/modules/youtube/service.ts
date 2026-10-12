import { Events, type Client } from "discord.js";
import { onReload } from "../../internal-api/reload";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { latestUploadIds, videoDetails, YoutubeError } from "./api";
import { decideUploads, uploadsPlaylistId } from "./logic";
import { premiereMessage, videoMessage } from "./message";
import { hasAnyVideo, knownVideoIds, readConfig, recordPoll, rememberVideo } from "./repository";

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
  const { YOUTUBE_API_KEY, YOUTUBE_CHANNEL_ID } = env();
  if (!YOUTUBE_API_KEY || !YOUTUBE_CHANNEL_ID) return { active: false, inactiveReason: "notConfigured" };
  return { active: true };
}

/** One poll. Never throws; the outcome is stored for the dashboard as a short code. */
export async function pollUploads(): Promise<void> {
  if (running || !discord) return;
  running = true;
  try {
    const { YOUTUBE_API_KEY: apiKey, YOUTUBE_CHANNEL_ID: channelId } = env();
    if (!apiKey || !channelId) return;
    const playlistId = uploadsPlaylistId(channelId);
    if (!playlistId) return;

    const config = await readConfig();
    // Polling continues while announcing is off, so switching it on never announces a backlog.
    const ids = await latestUploadIds(apiKey, playlistId);
    const known = await knownVideoIds(ids);
    const unseen = ids.filter((id) => !known.has(id));
    const details = await videoDetails(apiKey, unseen);
    const byId = new Map(details.map((d) => [d.videoId, d]));
    const firstRun = !(await hasAnyVideo());

    const decisions = decideUploads({
      videos: details,
      knownIds: known,
      firstRun,
      announceShorts: config.announceShorts,
      announcePremieres: config.announcePremieres,
      now: new Date(),
    });
    log.info(
      { seen: ids.length, unseen: unseen.length, announce: decisions.filter((d) => d.action === "announce").length, firstRun },
      "youtube: polled",
    );

    for (const decision of decisions) {
      const video = byId.get(decision.videoId);
      if (!video || decision.action === "wait") continue;

      let messageId: string | null = null;
      let announcedAt: Date | null = null;
      if (decision.action === "announce" || decision.action === "premiere") {
        if (!config.enabled || !config.channelId) {
          log.info({ videoId: video.videoId }, "youtube: new video, announcing is off, remembered silently");
        } else {
          const channel = await discord.channels.fetch(config.channelId).catch(() => null);
          if (!channel || channel.isDMBased() || channel.guildId !== env().DISCORD_GUILD_ID || !channel.isTextBased() || !("send" in channel)) {
            log.warn({ channelId: config.channelId }, "youtube: announcement channel missing or not a text channel, will retry");
            continue; // not remembered: the next round tries again
          }
          try {
            const message = await channel.send(
              decision.action === "premiere"
                ? premiereMessage(video, config.premiereTemplate, config.pingRoleId, config.embedColor, config.showWatchButton)
                : videoMessage(video, config.messageTemplate, config.pingRoleId, config.embedColor, config.showWatchButton),
            );
            messageId = message.id;
            announcedAt = new Date();
            log.info({ videoId: video.videoId, channelId: config.channelId, messageId }, "youtube: announced");
          } catch (err) {
            log.error({ err, videoId: video.videoId }, "youtube: could not post, will retry");
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
    await recordPoll(new Date(), "");
  } catch (err) {
    const code = err instanceof YoutubeError ? err.code : "failed";
    log.error({ err: err instanceof YoutubeError ? { code: err.code, status: err.status } : err }, "youtube: poll failed");
    await recordPoll(null, code).catch(() => undefined);
  } finally {
    running = false;
  }
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
