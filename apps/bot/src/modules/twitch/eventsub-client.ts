import { EVENTSUB_URL, parseFrame, RecentIds, type EventSubMessage } from "./protocol";

// The EventSub WebSocket connection, and nothing else: it keeps one session
// alive and hands over welcomes and events. What to subscribe to and what to do
// with an event is the caller's business.
//
// Rules from Twitch's docs, each handled below:
//  - subscribe within 10 s of a welcome or the server closes the socket
//  - no message (keepalives count) within keepalive_timeout_seconds = dead
//  - session_reconnect: open the new URL, wait for ITS welcome, then close the
//    old socket; subscriptions carry over, so no resubscribing then
//  - notifications can repeat: de-duplicated by message id

/** The slice of the WebSocket API used here, so tests can supply a fake. */
export interface SocketLike {
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: ((ev: { code?: number }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  close(code?: number): void;
}

export type SocketFactory = (url: string) => SocketLike;

export type EventSubHandlers = {
  /** A brand-new session: subscribe now (10 s budget). Throwing closes the socket and retries. */
  onSession: (sessionId: string) => Promise<void>;
  onOnline: (event: Extract<EventSubMessage, { kind: "online" }>["event"]) => void;
  onOffline: (event: Extract<EventSubMessage, { kind: "offline" }>["event"]) => void;
  onRevocation: (type: string, status: string) => void;
};

export type ClientLog = (level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) => void;

const BACKOFF_START_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;
const RATE_LIMIT_BACKOFF_MS = 30_000;
/** Slack on top of Twitch's keepalive timeout, for scheduling jitter. */
const KEEPALIVE_SLACK_MS = 5_000;
const SESSION_SETUP_BUDGET_MS = 9_000;

export class EventSubClient {
  private current: SocketLike | undefined;
  private pending: SocketLike | undefined; // the new socket during a session_reconnect
  private keepaliveTimer: ReturnType<typeof setTimeout> | undefined;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private backoff = BACKOFF_START_MS;
  private stopped = true;
  private readonly recent = new RecentIds();

  constructor(
    private readonly createSocket: SocketFactory,
    private readonly handlers: EventSubHandlers,
    private readonly log: ClientLog,
    private readonly url = EVENTSUB_URL,
  ) {}

  get connected(): boolean {
    return this.current !== undefined;
  }

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    this.connect(this.url, false);
  }

  stop(): void {
    this.stopped = true;
    clearTimeout(this.retryTimer);
    clearTimeout(this.keepaliveTimer);
    this.retryTimer = this.keepaliveTimer = undefined;
    for (const socket of [this.current, this.pending]) this.detach(socket)?.close(1000);
    this.current = this.pending = undefined;
  }

  /** Close and reconnect from scratch (e.g. after the token changed). */
  restart(): void {
    if (this.stopped) return;
    this.dropConnection("restart requested");
  }

  private connect(url: string, isReconnectHandoff: boolean): void {
    let socket: SocketLike;
    try {
      socket = this.createSocket(url);
    } catch (err) {
      this.log("error", "could not open the socket", { err });
      if (!isReconnectHandoff) this.scheduleRetry();
      return;
    }
    if (isReconnectHandoff) this.pending = socket;
    else this.current = socket;

    socket.onmessage = (ev) => {
      if (typeof ev.data !== "string") return;
      void this.handle(socket, ev.data, isReconnectHandoff);
    };
    socket.onerror = () => this.log("warn", "socket error", { handoff: isReconnectHandoff });
    socket.onclose = (ev) => {
      if (this.stopped) return;
      if (socket === this.pending) {
        // The handoff socket died before its welcome: stay on the old one.
        this.pending = undefined;
        this.log("warn", "reconnect socket closed before its welcome", { code: ev.code });
        return;
      }
      if (socket !== this.current) return; // an old socket we closed on purpose
      this.log("warn", "socket closed", { code: ev.code });
      this.current = undefined;
      clearTimeout(this.keepaliveTimer);
      this.scheduleRetry();
    };
  }

  private async handle(socket: SocketLike, raw: string, isHandoff: boolean): Promise<void> {
    if (this.stopped || (socket !== this.current && socket !== this.pending)) return;
    const message = parseFrame(raw);
    if (!message) {
      this.log("warn", "ignored a frame that did not parse");
      return;
    }
    // Any frame on the live socket proves it is alive.
    if (socket === this.current) this.armKeepalive(this.keepaliveMs);

    switch (message.kind) {
      case "welcome":
        await this.onWelcome(socket, message, isHandoff);
        return;
      case "keepalive":
        return;
      case "reconnect":
        if (socket === this.current && !this.pending) {
          this.log("info", "twitch asked to reconnect", {});
          this.connect(message.url, true);
        }
        return;
      case "online":
      case "offline":
        if (!this.recent.firstTime(message.messageId)) {
          this.log("info", "duplicate notification skipped", { messageId: message.messageId });
          return;
        }
        if (message.kind === "online") this.handlers.onOnline(message.event);
        else this.handlers.onOffline(message.event);
        return;
      case "revocation":
        this.handlers.onRevocation(message.type, message.status);
        return;
      case "ignored":
        this.log("info", "ignored message", { reason: message.reason });
        return;
    }
  }

  private keepaliveMs = 10_000 + KEEPALIVE_SLACK_MS;

  private async onWelcome(socket: SocketLike, message: Extract<EventSubMessage, { kind: "welcome" }>, isHandoff: boolean) {
    this.keepaliveMs = message.keepaliveSeconds * 1000 + KEEPALIVE_SLACK_MS;

    if (isHandoff && socket === this.pending) {
      // The new session inherited the subscriptions: swap and close the old one.
      const old = this.current;
      this.current = socket;
      this.pending = undefined;
      this.detach(old)?.close(1000);
      this.armKeepalive(this.keepaliveMs);
      this.backoff = BACKOFF_START_MS;
      this.log("info", "moved to the new session", {});
      return;
    }

    this.armKeepalive(this.keepaliveMs);
    try {
      await withTimeout(this.handlers.onSession(message.sessionId), SESSION_SETUP_BUDGET_MS);
      this.backoff = BACKOFF_START_MS;
      this.log("info", "session ready", {});
    } catch (err) {
      this.log("error", "subscribing failed, reconnecting", { err });
      // A 429 is Twitch's cost or rate limit: the half-made subscriptions of this session (or of a still-closing old
      // process) must be gone before the next try, so a quick retry only feeds the loop. Wait at least 30 s.
      if ((err as { code?: string } | null)?.code === "rateLimited") this.backoff = Math.max(this.backoff, RATE_LIMIT_BACKOFF_MS);
      if (socket === this.current) this.dropConnection("subscribe failed");
    }
  }

  private armKeepalive(ms: number): void {
    clearTimeout(this.keepaliveTimer);
    this.keepaliveTimer = setTimeout(() => {
      this.log("warn", "no message within the keepalive window, reconnecting", {});
      this.dropConnection("keepalive timeout");
    }, ms);
  }

  /** Close the live socket without waiting for its close event, then reconnect with backoff. */
  private dropConnection(reason: string): void {
    this.log("info", "dropping the connection", { reason });
    clearTimeout(this.keepaliveTimer);
    this.detach(this.current)?.close(1000);
    this.detach(this.pending)?.close(1000);
    this.current = this.pending = undefined;
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, BACKOFF_MAX_MS);
    this.log("info", "reconnecting", { inMs: wait });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      if (!this.stopped) this.connect(this.url, false);
    }, wait);
  }

  private detach(socket: SocketLike | undefined): SocketLike | undefined {
    if (socket) socket.onmessage = socket.onclose = socket.onerror = socket.onopen = null;
    return socket;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
