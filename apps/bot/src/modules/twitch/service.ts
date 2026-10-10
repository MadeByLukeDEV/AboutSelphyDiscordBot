import { Events, type Client, type GuildTextBasedChannel } from "discord.js";
import type { TwitchNotification, TwitchStreamer } from "@aboutselphy/db";
import { MAX_TWITCH_STREAMERS, type TwitchResolveResponse } from "@aboutselphy/shared";
import { onReload } from "../../internal-api/reload";
import { integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { EventSubClient, type SocketLike } from "./eventsub-client";
import { getLiveStreams, getUsersByLogin, subscribe, TwitchError, type LiveStream } from "./helix";
import { endedMessage, liveMessage, type StreamView } from "./notification";
import type { StreamOfflineEvent, StreamOnlineEvent } from "./protocol";
import { planReconcile } from "./reconcile";
import {
  createNotification,
  findNotification,
  hasAnyNotification,
  listOpenNotifications,
  listStreamers,
  markNotificationEnded,
  openNotificationsFor,
  readConfig,
  updateStreamerNames,
} from "./repository";
import { forgetAccessToken, getAccessToken, NoTwitchToken, twitchCredentials } from "./tokens";

// Went Live. One EventSub WebSocket for the whole bot; the announcements are
// idempotent (unique Twitch stream id), serialised per stream, and repaired on
// every (re)connect from Helix, so a missed event only delays an announcement.

let discord: Client | undefined;
let socket: EventSubClient | undefined;
const mutex = new KeyedMutex();
let lastSessionAt: Date | undefined;

export type TwitchRuntime = {
  /** Whether this process may touch Twitch and post at all. */
  active: boolean;
  /** Why not, when it isn't. */
  inactiveReason?: "disabledInDev" | "notConfigured";
  connected: boolean;
  lastSessionAt?: Date;
};

export function twitchRuntime(): TwitchRuntime {
  if (!integrationsActive()) return { active: false, inactiveReason: "disabledInDev", connected: false };
  if (!twitchCredentials()) return { active: false, inactiveReason: "notConfigured", connected: false };
  return { active: true, connected: socket?.connected ?? false, lastSessionAt };
}

export function startTwitch(client: Client): void {
  discord = client;
  const runtime = twitchRuntime();
  if (!runtime.active) {
    log.info({ reason: runtime.inactiveReason }, "twitch: not starting");
    return;
  }

  socket = new EventSubClient(
    (url) => new WebSocket(url) as unknown as SocketLike,
    {
      onSession: subscribeAll,
      onOnline: (event) => void onOnline(event).catch((err) => log.error({ err }, "twitch: online handler failed")),
      onOffline: (event) => void onOffline(event).catch((err) => log.error({ err }, "twitch: offline handler failed")),
      onRevocation: (type, status) => {
        log.warn({ type, status }, "twitch: a subscription was revoked");
        // The grant behind this socket is gone: a fresh start re-reads the token and says so clearly.
        forgetAccessToken();
        socket?.restart();
      },
    },
    (level, message, data) => log[level](data ?? {}, `twitch: ${message}`),
  );

  // The dashboard changed streamers or switches: a new session resubscribes to exactly the current set.
  onReload("twitch", () => socket?.restart());
  client.once(Events.ClientReady, () => socket?.start());
}

export function stopTwitch(): void {
  socket?.stop();
}

/** Settings or streamers changed in this process: start a fresh session so the subscriptions match. */
export function refreshTwitch(): void {
  socket?.restart();
}

// -- subscribing ------------------------------------------------------------------------

async function subscribeAll(sessionId: string): Promise<void> {
  const credentials = twitchCredentials();
  if (!credentials) return;
  const config = await readConfig();
  if (!config.enabled) {
    log.info({}, "twitch: module is switched off, staying connected without subscriptions");
    return;
  }
  const enabledStreamers = (await listStreamers()).filter((s) => s.enabled);
  if (enabledStreamers.length > MAX_TWITCH_STREAMERS) {
    log.warn({ configured: enabledStreamers.length, max: MAX_TWITCH_STREAMERS }, "twitch: more channels than one connection can subscribe to, the rest are ignored");
  }
  const streamers = enabledStreamers.slice(0, MAX_TWITCH_STREAMERS);
  if (streamers.length === 0) {
    log.info({}, "twitch: no streamers configured");
    return;
  }

  let token: string;
  try {
    token = await getAccessToken();
  } catch (err) {
    if (err instanceof NoTwitchToken) {
      log.warn({ reason: err.reason }, "twitch: no usable token, connect the account in the dashboard");
      return; // not an error to retry: nothing changes until someone connects
    }
    throw err;
  }

  // Max 300 subscriptions per socket and a total cost of 10 for sockets without a
  // matching user: two per streamer is far below that for a handful of channels.
  for (const streamer of streamers) {
    await subscribe(credentials, token, "stream.online", streamer.twitchUserId, sessionId);
    await subscribe(credentials, token, "stream.offline", streamer.twitchUserId, sessionId);
  }
  lastSessionAt = new Date();
  log.info({ streamers: streamers.length }, "twitch: subscribed");

  // Not awaited: the 10 s budget for subscribing is over, repairing may take longer.
  void reconcile(streamers).catch((err) => log.error({ err }, "twitch: reconcile failed"));
}

// -- events ---------------------------------------------------------------------------------

async function onOnline(event: StreamOnlineEvent): Promise<void> {
  if (event.type !== "live") {
    log.info({ type: event.type, login: event.broadcaster_user_login }, "twitch: not a live broadcast, skipped");
    return;
  }
  const streamer = await activeStreamer(event.broadcaster_user_id);
  if (!streamer) return;

  // The event has no title or game: ask Helix, and fall back to bare facts if it lags behind.
  let details: LiveStream | undefined;
  try {
    const credentials = twitchCredentials();
    if (credentials) details = (await getLiveStreams(credentials, await getAccessToken(), [streamer.twitchUserId]))[0];
  } catch (err) {
    log.warn({ err }, "twitch: could not read stream details, announcing without them");
  }
  await announce(streamer, {
    id: event.id,
    startedAt: new Date(event.started_at),
    title: details?.id === event.id ? details.title : "",
    game: details?.id === event.id ? details.game : "",
    thumbnailUrl: details?.id === event.id ? details.thumbnailUrl : "",
    displayName: event.broadcaster_user_name,
    login: event.broadcaster_user_login,
  });
}

async function onOffline(event: StreamOfflineEvent): Promise<void> {
  const open = await openNotificationsFor(event.broadcaster_user_id);
  if (open.length === 0) {
    log.info({ login: event.broadcaster_user_login }, "twitch: went offline, nothing was announced for it");
    return;
  }
  for (const row of open) await finish(row);
}

async function activeStreamer(twitchUserId: string): Promise<TwitchStreamer | undefined> {
  const config = await readConfig();
  if (!config.enabled) {
    log.info({ twitchUserId }, "twitch: module off, event skipped");
    return undefined;
  }
  const streamer = (await listStreamers()).find((s) => s.twitchUserId === twitchUserId);
  if (!streamer || !streamer.enabled) {
    log.info({ twitchUserId }, "twitch: channel not configured or paused, event skipped");
    return undefined;
  }
  return streamer;
}

// -- announcing -----------------------------------------------------------------------------------

type Broadcast = StreamView & { id: string };

/** Posts the message and records it; a stream id that already has a row is never posted twice. */
function announce(streamer: TwitchStreamer, broadcast: Broadcast): Promise<void> {
  return mutex.run(`stream:${broadcast.id}`, async () => {
    if (await findNotification(broadcast.id)) {
      log.info({ streamId: broadcast.id }, "twitch: already announced, skipped");
      return;
    }
    const channel = await textChannel(streamer.channelId);
    if (!channel) return;

    const message = await channel.send(liveMessage(broadcast, streamer.messageTemplate, streamer.pingRoleId, {
        color: streamer.embedColor,
        showThumbnail: streamer.showThumbnail,
        showGame: streamer.showGame,
      }));
    await createNotification({
      twitchStreamId: broadcast.id,
      twitchUserId: streamer.twitchUserId,
      login: broadcast.login,
      displayName: broadcast.displayName,
      title: broadcast.title.slice(0, 300),
      game: broadcast.game.slice(0, 200),
      channelId: streamer.channelId,
      messageId: message.id,
      startedAt: broadcast.startedAt,
    });
    log.info({ streamId: broadcast.id, login: broadcast.login, channelId: streamer.channelId }, "twitch: announced");
  });
}

/** Marks a broadcast ended and, if configured, edits its message. Safe to call twice. */
function finish(row: TwitchNotification): Promise<void> {
  return mutex.run(`stream:${row.twitchStreamId}`, async () => {
    const endedAt = new Date();
    if (!(await markNotificationEnded(row.id, endedAt))) return; // another path already did
    log.info({ streamId: row.twitchStreamId, login: row.login }, "twitch: broadcast ended");

    const config = await readConfig();
    if (!config.markEndedOnOffline || !row.messageId) return;
    const channel = await textChannel(row.channelId);
    if (!channel) return;
    try {
      const message = await channel.messages.fetch(row.messageId);
      await message.edit(
        endedMessage(
          { login: row.login, displayName: row.displayName, title: row.title, game: row.game, startedAt: row.startedAt, thumbnailUrl: "" },
          endedAt,
        ),
      );
    } catch (err) {
      // Deleted by a moderator, or the bot lost access: the row is already closed, nothing else to do.
      log.warn({ err, messageId: row.messageId }, "twitch: could not edit the announcement");
    }
  });
}

async function textChannel(channelId: string): Promise<GuildTextBasedChannel | undefined> {
  const channel = await discord?.channels.fetch(channelId).catch(() => null);
  if (!channel || channel.isDMBased() || !channel.isTextBased()) {
    log.warn({ channelId }, "twitch: announcement channel is missing or not a text channel");
    return undefined;
  }
  return channel;
}

// -- repairing after a (re)connect -------------------------------------------------------------

async function reconcile(streamers: TwitchStreamer[]): Promise<void> {
  const credentials = twitchCredentials();
  if (!credentials || streamers.length === 0) return;
  const token = await getAccessToken();

  const live = await getLiveStreams(credentials, token, streamers.map((s) => s.twitchUserId));
  const open = await listOpenNotifications();
  const known = new Set<string>();
  const history = new Set<string>();
  for (const s of live) {
    if (await findNotification(s.id)) known.add(s.id);
    if (await hasAnyNotification(s.userId)) history.add(s.userId);
  }

  const plan = planReconcile({
    live: live.map((s) => ({ id: s.id, userId: s.userId, startedAt: s.startedAt })),
    open: open.map((r) => ({ id: r.id, twitchStreamId: r.twitchStreamId, twitchUserId: r.twitchUserId })),
    knownStreamIds: known,
    channelsWithHistory: history,
    now: new Date(),
  });
  log.info(
    { live: live.length, announce: plan.announce.length, baseline: plan.baseline.length, close: plan.close.length },
    "twitch: reconciled",
  );

  const byId = new Map(live.map((s) => [s.id, s]));
  const streamerOf = new Map(streamers.map((s) => [s.twitchUserId, s]));

  for (const item of plan.announce) {
    const stream = byId.get(item.id);
    const streamer = streamerOf.get(item.userId);
    if (stream && streamer) await announce(streamer, toBroadcast(stream)).catch((err) => log.error({ err }, "twitch: late announcement failed"));
  }
  for (const item of plan.baseline) {
    const stream = byId.get(item.id);
    const streamer = streamerOf.get(item.userId);
    if (!stream || !streamer) continue;
    await mutex.run(`stream:${stream.id}`, async () => {
      if (await findNotification(stream.id)) return;
      await createNotification({
        twitchStreamId: stream.id,
        twitchUserId: stream.userId,
        login: stream.login,
        displayName: stream.name,
        title: stream.title.slice(0, 300),
        game: stream.game.slice(0, 200),
        channelId: streamer.channelId,
        messageId: null, // silent: nothing was posted
        startedAt: stream.startedAt,
      });
    });
    log.info({ streamId: stream.id, login: stream.login }, "twitch: already live, remembered without announcing");
  }
  for (const row of plan.close) {
    const full = open.find((r) => r.id === row.id);
    if (full) await finish(full).catch((err) => log.error({ err }, "twitch: closing a stale broadcast failed"));
  }

  // Keep the stored names current (a streamer may rename their channel).
  for (const stream of live) await updateStreamerNames(stream.userId, stream.login, stream.name);
}

function toBroadcast(stream: LiveStream): Broadcast {
  return {
    id: stream.id,
    login: stream.login,
    displayName: stream.name,
    title: stream.title,
    game: stream.game,
    startedAt: stream.startedAt,
    thumbnailUrl: stream.thumbnailUrl,
  };
}

// -- used by the /twitch command -------------------------------------------------------------------

export type ResolvedChannel = { id: string; login: string; displayName: string };

/** Looks a channel up by its login name; undefined if it doesn't exist. Throws NoTwitchToken / TwitchError otherwise. */
export async function resolveChannel(login: string): Promise<ResolvedChannel | undefined> {
  const credentials = twitchCredentials();
  if (!credentials) throw new NoTwitchToken("notConfigured");
  const [found] = await getUsersByLogin(credentials, await getAccessToken(), [login.toLowerCase()]);
  return found && { id: found.id, login: found.login, displayName: found.displayName };
}

/** For the dashboard: the same lookup as /twitch add, as a result instead of an exception. */
export async function lookupTwitchChannel(login: string): Promise<TwitchResolveResponse> {
  try {
    const found = await resolveChannel(login);
    return found ? { status: "found", channel: { id: found.id, login: found.login, displayName: found.displayName } } : { status: "notFound" };
  } catch (err) {
    log.warn({ err: err instanceof TwitchError ? { code: err.code, status: err.status } : err }, "twitch: channel lookup failed");
    return { status: "unavailable" };
  }
}

export { NoTwitchToken, TwitchError };
