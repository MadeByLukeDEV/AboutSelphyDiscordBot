"use server";

import { endpointInput, outboundInput } from "@aboutselphy/shared/webhooks";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveEndpointResult, SaveOutboundResult, SimpleWebhookResult, TestWebhookResult } from "./schema";
import { removeEndpoint, removeOutbound, rotateEndpointSecret, saveEndpoint, saveOutbound, testOutbound } from "./service";

// Public POST endpoints like every Server Action: each one checks the session and the role itself
// (admins only), validates its input, and returns codes (never error text). A secret is returned only
// by the call that made it.

async function admin() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
}

const validId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 64;

export async function saveEndpointAction(input: unknown): Promise<SaveEndpointResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = endpointInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveEndpoint(parsed.data, session.user.name);
}

export async function rotateEndpointSecretAction(id: unknown): Promise<SaveEndpointResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return rotateEndpointSecret(id);
}

export async function deleteEndpointAction(id: unknown): Promise<SimpleWebhookResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeEndpoint(id);
}

export async function saveOutboundAction(input: unknown): Promise<SaveOutboundResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = outboundInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveOutbound(parsed.data, session.user.name);
}

export async function deleteOutboundAction(id: unknown): Promise<SimpleWebhookResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeOutbound(id);
}

export async function testOutboundAction(id: unknown): Promise<TestWebhookResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return testOutbound(id);
}
