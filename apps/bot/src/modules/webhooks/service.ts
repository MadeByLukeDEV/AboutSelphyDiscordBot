import { randomUUID } from "node:crypto";
import { Events, type Client, type Guild } from "discord.js";
import type { OutboundWebhook } from "@aboutselphy/db";
import type { WebhookRelayStatus, WebhookTestStatus } from "@aboutselphy/shared";
import { decryptToken } from "@aboutselphy/shared/token-cipher";
import { sign } from "@aboutselphy/shared/webhook-signature";
import type { AnyWebhookEvent } from "@aboutselphy/shared/webhooks";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { postJson } from "../../lib/safe-http";
import { findOutbound, listEnabledFor, recordResult } from "./repository";
import { buildRelayEmbed, describeEvent, isRetryable, RETRY_DELAYS_MS } from "./rules";

// Webhooks. Incoming: the dashboard's public endpoint verifies a signed request and asks the bot to
// post it (relayMessage). Outgoing: emitEvent sends an event to every enabled webhook that wants it,
// as a formatted Discord message or as signed JSON. Addresses and secrets are stored encrypted; the
// bot decrypts them only to send. Sending is best effort and never delays or breaks the feature that
// raised the event; a failed delivery is retried twice, the result is remembered for the dashboard, and ten failures in a row switch the webhook off.

const URL_PURPOSE = "webhook-outbound-url";
const SECRET_PURPOSE = "webhook-outbound-secret";

/** Posts a relayed message into a channel. */
export async function relayMessage(guild: Guild, m: { channelId: string; source: string; title?: string; content?: string; url?: string; color?: number }): Promise<WebhookRelayStatus> {
  try {
    const channel = await guild.channels.fetch(m.channelId).catch(() => null);
    if (!channel || channel.isDMBased() || !channel.isTextBased() || !("send" in channel)) return "channel";
    await channel.send(buildRelayEmbed(m));
    log.info({ channelId: m.channelId, source: m.source }, "webhook relayed");
    return "done";
  } catch (err) {
    log.error({ err }, "relaying a webhook message failed");
    return "failed";
  }
}

type Prepared = { url: string; body: string; headers: Record<string, string> };

/** Builds the request once, so every retry sends the same body (and the same event id). A string is a final status (nothing can be sent). */
function prepare(hook: OutboundWebhook, event: AnyWebhookEvent, data: unknown): Prepared | string {
  const key = env().TOKEN_ENCRYPTION_KEY;
  if (!key) return "no key";
  let url: string;
  let secret: string | null = null;
  try {
    url = decryptToken(hook.urlEnc, URL_PURPOSE, key);
    secret = hook.secretEnc ? decryptToken(hook.secretEnc, SECRET_PURPOSE, key) : null;
  } catch {
    return "key mismatch"; // the stored value can't be read with this key
  }

  let body: string;
  const headers: Record<string, string> = {};
  if (hook.kind === "discord") {
    const d = describeEvent(event, data);
    body = JSON.stringify({ username: "AboutSelphy Bot", embeds: [{ title: d.title.slice(0, 256), description: d.description.slice(0, 2000), color: d.color, timestamp: new Date().toISOString() }], allowed_mentions: { parse: [] } });
  } else {
    const timestamp = String(Math.floor(Date.now() / 1000));
    body = JSON.stringify({ id: randomUUID(), event, timestamp: Number(timestamp), data });
    headers["x-webhook-event"] = event;
    headers["x-webhook-timestamp"] = timestamp;
    if (secret) headers["x-webhook-signature"] = sign(secret, timestamp, body);
  }
  return { url, body, headers };
}

async function attempt(request: Prepared): Promise<string> {
  const result = await postJson(request.url, request.body, request.headers);
  if (!result.ok) return result.reason;
  return result.status >= 200 && result.status < 300 ? "ok" : `http ${result.status}`;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Sends one event to one webhook; returns the short status that is remembered. A try that might work next time (network
 * trouble, timeout, 5xx, 408, 429) is repeated after 2 s and 10 s with the same body; the signature timestamp stays well inside
 * the receiver's tolerance. `retry` is off for the dashboard's test button, which should answer at once.
 */
async function sendOne(hook: OutboundWebhook, event: AnyWebhookEvent, data: unknown, retry = true): Promise<string> {
  const request = prepare(hook, event, data);
  if (typeof request === "string") return request;
  let status = await attempt(request);
  if (!retry) return status;
  for (const delay of RETRY_DELAYS_MS) {
    if (!isRetryable(status)) break;
    await sleep(delay);
    status = await attempt(request);
  }
  return status;
}

/** Sends an event to every enabled webhook that subscribed to it. Never throws and never waits for the receivers (each webhook has its own task, so a slow one doesn't hold up the others). */
export function emitEvent(event: Exclude<AnyWebhookEvent, "test">, data: unknown): void {
  if (!integrationsActive()) return;
  void (async () => {
    for (const hook of await listEnabledFor(event)) {
      void (async () => {
        const status = await sendOne(hook, event, data).catch((err) => {
          log.warn({ err, hook: hook.id }, "webhook: sending failed");
          return "error";
        });
        const disabled = await recordResult(hook.id, status, true).catch(() => false);
        if (status !== "ok") log.warn({ hook: hook.id, event, status }, "webhook: not delivered");
        if (disabled) log.warn({ hook: hook.id, name: hook.name }, "webhook: switched off after repeated failures");
      })();
    }
  })().catch((err) => log.warn({ err }, "webhook: emit failed"));
}

/** The dashboard's "Send a test" button. */
export async function sendTest(id: string): Promise<WebhookTestStatus> {
  try {
    const hook = await findOutbound(id);
    if (!hook) return "not-found";
    if (!env().TOKEN_ENCRYPTION_KEY) return "not-configured";
    const status = await sendOne(hook, "test", { message: "test" }, false);
    await recordResult(hook.id, status, false);
    return status === "ok" ? "ok" : "failed";
  } catch (err) {
    log.error({ err }, "webhook test failed");
    return "failed";
  }
}

/** Sends "member joined" to the webhooks that want it. Humans only; the server is the configured one. Called once from the bot's start-up. */
export function startMemberEvents(client: Client): void {
  client.on(Events.GuildMemberAdd, (member) => {
    if (member.guild.id !== env().DISCORD_GUILD_ID || member.user.bot || !integrationsActive()) return;
    emitEvent("member.joined", { userId: member.id, name: member.user.username, accountCreatedAt: member.user.createdAt.toISOString(), memberCount: member.guild.memberCount });
  });
}
