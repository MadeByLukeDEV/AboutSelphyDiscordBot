import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventSubClient, type SocketLike } from "./eventsub-client";

class FakeSocket implements SocketLike {
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onclose: SocketLike["onclose"] = null;
  onerror: SocketLike["onerror"] = null;
  closed = false;
  constructor(readonly url: string) {}
  close() {
    this.closed = true;
  }
  receive(message_type: string, payload: unknown, message_id = Math.random().toString(36)) {
    this.onmessage?.({ data: JSON.stringify({ metadata: { message_id, message_type }, payload }) });
  }
  welcome(id = "S1", keepalive = 10) {
    this.receive("session_welcome", { session: { id, keepalive_timeout_seconds: keepalive } });
  }
}

const online = {
  id: "9001",
  broadcaster_user_id: "42",
  broadcaster_user_login: "selphy",
  broadcaster_user_name: "Selphy",
  type: "live",
  started_at: "2026-10-12T10:00:00Z",
};

function setup() {
  const sockets: FakeSocket[] = [];
  const handlers = {
    onSession: vi.fn(async () => {}),
    onOnline: vi.fn(),
    onOffline: vi.fn(),
    onRevocation: vi.fn(),
  };
  const client = new EventSubClient((url) => {
    const s = new FakeSocket(url);
    sockets.push(s);
    return s;
  }, handlers, () => {});
  return { sockets, handlers, client };
}

const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("EventSubClient", () => {
  it("subscribes on the welcome and passes events on once", async () => {
    const { sockets, handlers, client } = setup();
    client.start();
    sockets[0]!.welcome("S1");
    await flush();
    expect(handlers.onSession).toHaveBeenCalledWith("S1");

    const payload = { subscription: { type: "stream.online" }, event: online };
    sockets[0]!.receive("notification", payload, "same-id");
    sockets[0]!.receive("notification", payload, "same-id");
    await flush();
    expect(handlers.onOnline).toHaveBeenCalledTimes(1);
    client.stop();
  });

  it("reconnects with backoff when the socket closes, and resubscribes", async () => {
    const { sockets, handlers, client } = setup();
    client.start();
    sockets[0]!.welcome("S1");
    await flush();
    sockets[0]!.onclose?.({ code: 1006 });
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    sockets[1]!.welcome("S2");
    await flush();
    expect(handlers.onSession).toHaveBeenLastCalledWith("S2");
    client.stop();
  });

  it("treats silence beyond the keepalive window as dead", async () => {
    const { sockets, client } = setup();
    client.start();
    sockets[0]!.welcome("S1", 10);
    await flush();
    await vi.advanceTimersByTimeAsync(14_000);
    expect(sockets[0]!.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(2_000); // 10 s + 5 s slack passed
    expect(sockets[0]!.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    client.stop();
  });

  it("keepalives keep the session alive", async () => {
    const { sockets, client } = setup();
    client.start();
    sockets[0]!.welcome("S1", 10);
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(9_000);
      sockets[0]!.receive("session_keepalive", {});
    }
    expect(sockets[0]!.closed).toBe(false);
    client.stop();
  });

  it("follows session_reconnect without resubscribing, then closes the old socket", async () => {
    const { sockets, handlers, client } = setup();
    client.start();
    sockets[0]!.welcome("S1");
    await flush();
    sockets[0]!.receive("session_reconnect", { session: { id: "S1", reconnect_url: "wss://eventsub.wss.twitch.tv/ws?new=1" } });
    expect(sockets).toHaveLength(2);
    expect(sockets[1]!.url).toBe("wss://eventsub.wss.twitch.tv/ws?new=1");
    expect(sockets[0]!.closed).toBe(false); // not before the new welcome
    sockets[1]!.welcome("S1b");
    await flush();
    expect(sockets[0]!.closed).toBe(true);
    expect(handlers.onSession).toHaveBeenCalledTimes(1);
    client.stop();
  });

  it("stays on the old socket if the reconnect socket dies before its welcome", async () => {
    const { sockets, client } = setup();
    client.start();
    sockets[0]!.welcome("S1");
    await flush();
    sockets[0]!.receive("session_reconnect", { session: { id: "S1", reconnect_url: "wss://eventsub.wss.twitch.tv/ws?new=1" } });
    sockets[1]!.onclose?.({ code: 1006 });
    expect(sockets[0]!.closed).toBe(false);
    expect(client.connected).toBe(true);
    client.stop();
  });

  it("drops the connection and retries when subscribing fails", async () => {
    const { sockets, handlers, client } = setup();
    handlers.onSession.mockRejectedValueOnce(new Error("boom"));
    client.start();
    sockets[0]!.welcome("S1");
    await flush();
    expect(sockets[0]!.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sockets).toHaveLength(2);
    client.stop();
  });

  it("stop() closes everything and never reconnects", async () => {
    const { sockets, client } = setup();
    client.start();
    sockets[0]!.welcome("S1");
    await flush();
    client.stop();
    expect(sockets[0]!.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sockets).toHaveLength(1);
  });
});
