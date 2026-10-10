import "server-only";
import { decryptToken, encryptToken } from "@aboutselphy/shared/token-cipher";
import { newSecret } from "@aboutselphy/shared/webhook-signature";
import { MAX_ENDPOINTS, MAX_OUTBOUND, OUTBOUND_EVENTS, type EndpointInput, type OutboundEvent, type OutboundInput } from "@aboutselphy/shared/webhooks";
import { env, siteUrl } from "@/lib/env";
import { errorInfo } from "@/lib/log";
import { listChannels, testOutboundWebhookViaBot } from "@/modules/bot-api";
import {
  countEndpoints,
  countOutbound,
  createEndpoint,
  createOutbound,
  deleteEndpoint,
  deleteOutbound,
  findEndpoint,
  findOutbound,
  listEndpoints,
  listOutbound,
  updateEndpoint,
  updateOutbound,
} from "./repository";
import type { EndpointRow, OutboundRow, SaveEndpointResult, SaveOutboundResult, SimpleWebhookResult, TestWebhookResult } from "./schema";

export const ENDPOINT_SECRET_PURPOSE = "webhook-endpoint-secret";
const URL_PURPOSE = "webhook-outbound-url";
const OUTBOUND_SECRET_PURPOSE = "webhook-outbound-secret";

const key = () => env().TOKEN_ENCRYPTION_KEY;
const endpointUrl = (id: string) => `${siteUrl()}/api/webhooks/in/${id}`;

/** Only the host of a stored address is ever shown: the rest (a Discord webhook's token, a path with a key) is a secret. */
function hostOf(urlEnc: string): string {
  try {
    const k = key();
    return k ? new URL(decryptToken(urlEnc, URL_PURPOSE, k)).hostname : "unreadable";
  } catch {
    return "unreadable";
  }
}

export async function getWebhooksPage() {
  const [endpoints, outbound, channels] = await Promise.all([listEndpoints(), listOutbound(), listChannels(["text"])]);
  const endpointRows: EndpointRow[] = endpoints.map((e) => ({ id: e.id, name: e.name, channelId: e.channelId, enabled: e.enabled, uses: e.uses, lastUsedAt: e.lastUsedAt?.toISOString() ?? null, url: endpointUrl(e.id) }));
  const outboundRows: OutboundRow[] = outbound.map((o) => ({
    id: o.id,
    name: o.name,
    kind: o.kind === "discord" ? "discord" : "generic",
    events: o.events.filter((e): e is OutboundEvent => (OUTBOUND_EVENTS as readonly string[]).includes(e)),
    enabled: o.enabled,
    host: hostOf(o.urlEnc),
    lastStatus: o.lastStatus,
    lastAt: o.lastAt?.toISOString() ?? null,
  }));
  return { endpoints: endpointRows, outbound: outboundRows, channels, ready: Boolean(key()) };
}

// -- incoming endpoints -------------------------------------------------------------------------

/** Adds (no id) or changes (with id) an endpoint. A new endpoint gets its secret now; this is the only time it can be read. */
export async function saveEndpoint(input: EndpointInput, byName: string): Promise<SaveEndpointResult> {
  try {
    const k = key();
    if (!k) return { ok: false, error: "notReady" };
    const existing = input.id ? await findEndpoint(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (!existing && (await countEndpoints()) >= MAX_ENDPOINTS) return { ok: false, error: "tooMany" };
    if (!existing || existing.channelId !== input.channelId) {
      const channels = await listChannels(["text"]);
      if (!channels) return { ok: false, error: "botUnavailable" };
      if (!channels.some((c) => c.id === input.channelId)) return { ok: false, error: "channelNotFound" };
    }
    if (existing) {
      await updateEndpoint(existing.id, { name: input.name, channelId: input.channelId, enabled: input.enabled });
      return { ok: true, id: existing.id, url: endpointUrl(existing.id), secret: null };
    }
    const secret = newSecret();
    const row = await createEndpoint({ name: input.name, channelId: input.channelId, enabled: input.enabled, secretEnc: encryptToken(secret, ENDPOINT_SECRET_PURPOSE, k), createdByName: byName.slice(0, 100) });
    console.info("[webhooks] endpoint created", { id: row.id, by: byName });
    return { ok: true, id: row.id, url: endpointUrl(row.id), secret };
  } catch (error) {
    console.error("[webhooks] saving an endpoint failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Makes a new secret; the old one stops working at once. */
export async function rotateEndpointSecret(id: string): Promise<SaveEndpointResult> {
  try {
    const k = key();
    if (!k) return { ok: false, error: "notReady" };
    if (!(await findEndpoint(id))) return { ok: false, error: "notFound" };
    const secret = newSecret();
    await updateEndpoint(id, { secretEnc: encryptToken(secret, ENDPOINT_SECRET_PURPOSE, k) });
    console.info("[webhooks] endpoint secret rotated", { id });
    return { ok: true, id, url: endpointUrl(id), secret };
  } catch (error) {
    console.error("[webhooks] rotating a secret failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeEndpoint(id: string): Promise<SimpleWebhookResult> {
  try {
    return (await deleteEndpoint(id)) === 0 ? { ok: false, error: "notFound" } : { ok: true };
  } catch (error) {
    console.error("[webhooks] removing an endpoint failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

// -- outgoing webhooks -----------------------------------------------------------------------------

/** Adds (no id) or changes (with id) an outbound webhook. The address is encrypted; a generic one gets its signing secret now (shown once). */
export async function saveOutbound(input: OutboundInput, byName: string): Promise<SaveOutboundResult> {
  try {
    const k = key();
    if (!k) return { ok: false, error: "notReady" };
    const existing = input.id ? await findOutbound(input.id) : null;
    if (input.id && !existing) return { ok: false, error: "notFound" };
    if (existing) {
      await updateOutbound(existing.id, { name: input.name, events: input.events, enabled: input.enabled, ...(input.url ? { urlEnc: encryptToken(input.url, URL_PURPOSE, k) } : {}) });
      return { ok: true, secret: null };
    }
    if ((await countOutbound()) >= MAX_OUTBOUND) return { ok: false, error: "tooMany" };
    const secret = input.kind === "generic" ? newSecret() : null;
    await createOutbound({
      name: input.name,
      kind: input.kind,
      urlEnc: encryptToken(input.url, URL_PURPOSE, k),
      secretEnc: secret ? encryptToken(secret, OUTBOUND_SECRET_PURPOSE, k) : null,
      events: input.events,
      enabled: input.enabled,
      createdByName: byName.slice(0, 100),
    });
    console.info("[webhooks] outbound webhook created", { kind: input.kind, by: byName });
    return { ok: true, secret };
  } catch (error) {
    console.error("[webhooks] saving an outbound webhook failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeOutbound(id: string): Promise<SimpleWebhookResult> {
  try {
    return (await deleteOutbound(id)) === 0 ? { ok: false, error: "notFound" } : { ok: true };
  } catch (error) {
    console.error("[webhooks] removing an outbound webhook failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

/** Asks the bot to send a test event to this webhook. */
export async function testOutbound(id: string): Promise<TestWebhookResult> {
  const status = await testOutboundWebhookViaBot(id);
  if (status === null) return { ok: false, error: "botUnavailable" };
  if (status === "ok") return { ok: true };
  return { ok: false, error: status === "not-found" ? "notFound" : status === "not-configured" ? "notReady" : "deliveryFailed" };
}
