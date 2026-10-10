import { randomUUID } from "node:crypto";
import type { Guild } from "discord.js";
import type { OutboundWebhook } from "@aboutselphy/db";
import type { WebhookRelayStatus, WebhookTestStatus } from "@aboutselphy/shared";
import { decryptToken } from "@aboutselphy/shared/token-cipher";
import { sign } from "@aboutselphy/shared/webhook-signature";
import type { AnyWebhookEvent } from "@aboutselphy/shared/webhooks";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { postJson } from "../../lib/safe-http";
import { findOutbound, listEnabledFor, recordResult } from "./repository";
import { buildRelayEmbed, describeEvent } from "./rules";

// Webhooks. Incoming: the dashboard's public endpoint verifies a signed request and asks the bot to
// post it (relayMessage). Outgoing: emitEvent sends an event to every enabled webhook that wants it,
// as a formatted Discord message or as signed JSON. Addresses and secrets are stored encrypted; the
// bot decrypts them only to send. Sending is best effort and never delays or breaks the feature that
// raised the event; one attempt, no retries, the result is remembered for the dashboard.

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

/** Sends one event to one webhook; returns the short status that is remembered. */
async function sendOne(hook: OutboundWebhook, event: AnyWebhookEvent, data: unknown): Promise<string> {
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
  const result = await postJson(url, body, headers);
  if (!result.ok) return result.reason;
  return result.status >= 200 && result.status < 300 ? "ok" : `http ${result.status}`;
}

/** Sends an event to every enabled webhook that subscribed to it. Never throws and never waits for the receivers. */
export function emitEvent(event: Exclude<AnyWebhookEvent, "test">, data: unknown): void {
  if (!integrationsActive()) return;
  void (async () => {
    for (const hook of await listEnabledFor(event)) {
      const status = await sendOne(hook, event, data).catch((err) => {
        log.warn({ err, hook: hook.id }, "webhook: sending failed");
        return "error";
      });
      await recordResult(hook.id, status).catch(() => undefined);
      if (status !== "ok") log.warn({ hook: hook.id, event, status }, "webhook: not delivered");
    }
  })().catch((err) => log.warn({ err }, "webhook: emit failed"));
}

/** The dashboard's "Send a test" button. */
export async function sendTest(id: string): Promise<WebhookTestStatus> {
  try {
    const hook = await findOutbound(id);
    if (!hook) return "not-found";
    if (!env().TOKEN_ENCRYPTION_KEY) return "not-configured";
    const status = await sendOne(hook, "test", { message: "test" });
    await recordResult(hook.id, status);
    return status === "ok" ? "ok" : "failed";
  } catch (err) {
    log.error({ err }, "webhook test failed");
    return "failed";
  }
}
