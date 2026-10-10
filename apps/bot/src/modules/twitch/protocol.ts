import { z } from "zod";

// What Twitch sends over the EventSub WebSocket. Everything is parsed with zod:
// the frames come from the network, and an unknown or malformed one is logged
// and skipped, never trusted. Field names follow
// https://dev.twitch.tv/docs/eventsub/handling-websocket-events

export const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";

const metadata = z.object({
  message_id: z.string().min(1),
  message_type: z.string(),
  message_timestamp: z.string().optional(),
});

const session = z.object({
  id: z.string().min(1),
  keepalive_timeout_seconds: z.number().int().positive().nullable().optional(),
  reconnect_url: z.string().nullable().optional(),
});

const streamOnline = z.object({
  id: z.string().min(1), // the stream id
  broadcaster_user_id: z.string().min(1),
  broadcaster_user_login: z.string().min(1),
  broadcaster_user_name: z.string().min(1),
  type: z.string(), // "live" | "playlist" | "watch_party" | "premiere" | "rerun"
  started_at: z.string().min(1),
});

const streamOffline = z.object({
  broadcaster_user_id: z.string().min(1),
  broadcaster_user_login: z.string().min(1),
  broadcaster_user_name: z.string().min(1),
});

export type StreamOnlineEvent = z.infer<typeof streamOnline>;
export type StreamOfflineEvent = z.infer<typeof streamOffline>;

export type EventSubMessage =
  | { kind: "welcome"; messageId: string; sessionId: string; keepaliveSeconds: number }
  | { kind: "keepalive"; messageId: string }
  | { kind: "reconnect"; messageId: string; url: string }
  | { kind: "online"; messageId: string; event: StreamOnlineEvent }
  | { kind: "offline"; messageId: string; event: StreamOfflineEvent }
  | { kind: "revocation"; messageId: string; type: string; status: string }
  | { kind: "ignored"; messageId: string; reason: string };

const DEFAULT_KEEPALIVE_SECONDS = 10;

/** One text frame to a typed message. Returns undefined when it isn't valid JSON of the expected shape. */
export function parseFrame(raw: string): EventSubMessage | undefined {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const envelope = z.object({ metadata, payload: z.record(z.string(), z.unknown()).default({}) }).safeParse(json);
  if (!envelope.success) return undefined;
  const { metadata: meta, payload } = envelope.data;
  const messageId = meta.message_id;

  switch (meta.message_type) {
    case "session_welcome": {
      const parsed = z.object({ session }).safeParse(payload);
      if (!parsed.success) return undefined;
      return {
        kind: "welcome",
        messageId,
        sessionId: parsed.data.session.id,
        keepaliveSeconds: parsed.data.session.keepalive_timeout_seconds ?? DEFAULT_KEEPALIVE_SECONDS,
      };
    }
    case "session_keepalive":
      return { kind: "keepalive", messageId };
    case "session_reconnect": {
      const parsed = z.object({ session }).safeParse(payload);
      const url = parsed.success ? parsed.data.session.reconnect_url : undefined;
      if (!url || !isTwitchSocketUrl(url)) return undefined;
      return { kind: "reconnect", messageId, url };
    }
    case "notification": {
      const parsed = z.object({ subscription: z.object({ type: z.string() }), event: z.unknown() }).safeParse(payload);
      if (!parsed.success) return undefined;
      if (parsed.data.subscription.type === "stream.online") {
        const event = streamOnline.safeParse(parsed.data.event);
        return event.success ? { kind: "online", messageId, event: event.data } : undefined;
      }
      if (parsed.data.subscription.type === "stream.offline") {
        const event = streamOffline.safeParse(parsed.data.event);
        return event.success ? { kind: "offline", messageId, event: event.data } : undefined;
      }
      return { kind: "ignored", messageId, reason: `subscription ${parsed.data.subscription.type}` };
    }
    case "revocation": {
      const parsed = z.object({ subscription: z.object({ type: z.string(), status: z.string() }) }).safeParse(payload);
      if (!parsed.success) return undefined;
      return { kind: "revocation", messageId, type: parsed.data.subscription.type, status: parsed.data.subscription.status };
    }
    default:
      return { kind: "ignored", messageId, reason: `message type ${meta.message_type}` };
  }
}

/**
 * The reconnect URL comes from Twitch, but the socket will connect wherever it
 * says, so only Twitch's own EventSub hosts are followed.
 */
export function isTwitchSocketUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "wss:" && url.hostname.endsWith(".wss.twitch.tv");
  } catch {
    return false;
  }
}

/** Twitch can repeat a notification (within ~10 minutes); remember recent ids. */
export class RecentIds {
  private readonly seen = new Map<string, number>();
  constructor(
    private readonly ttlMs = 15 * 60_000,
    private readonly max = 500,
  ) {}

  /** True the first time an id is offered, false for a repeat. */
  firstTime(id: string, now = Date.now()): boolean {
    for (const [key, at] of this.seen) {
      if (now - at > this.ttlMs || this.seen.size > this.max) this.seen.delete(key);
      else break; // insertion order = age order
    }
    if (this.seen.has(id)) return false;
    this.seen.set(id, now);
    return true;
  }
}
