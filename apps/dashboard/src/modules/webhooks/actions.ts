"use server";

import { endpointInput, outboundInput } from "@aboutselphy/shared/webhooks";
import { AuthorizationError, requireAdmin } from "@/modules/auth";
import type { SaveEndpointResult, SaveOutboundResult, SimpleWebhookResult, TestWebhookResult } from "./schema";
import { removeEndpoint, removeOutbound, rotateEndpointSecret, saveEndpoint, saveOutbound, testOutbound } from "./service";
import { audited } from "@/modules/audit";

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

async function saveEndpointActionRun(input: unknown): Promise<SaveEndpointResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = endpointInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveEndpoint(parsed.data, session.user.name);
}

async function rotateEndpointSecretActionRun(id: unknown): Promise<SaveEndpointResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return rotateEndpointSecret(id);
}

async function deleteEndpointActionRun(id: unknown): Promise<SimpleWebhookResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeEndpoint(id);
}

async function saveOutboundActionRun(input: unknown): Promise<SaveOutboundResult> {
  const session = await admin();
  if (!session) return { ok: false, error: "forbidden" };
  const parsed = outboundInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return saveOutbound(parsed.data, session.user.name);
}

async function deleteOutboundActionRun(id: unknown): Promise<SimpleWebhookResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return removeOutbound(id);
}

export async function testOutboundAction(id: unknown): Promise<TestWebhookResult> {
  if (!(await admin())) return { ok: false, error: "forbidden" };
  if (!validId(id)) return { ok: false, error: "invalid" };
  return testOutbound(id);
}

export async function saveEndpointAction(...args: Parameters<typeof saveEndpointActionRun>): ReturnType<typeof saveEndpointActionRun> {
  return audited("webhooks.saveEndpoint", saveEndpointActionRun, args);
}

export async function rotateEndpointSecretAction(...args: Parameters<typeof rotateEndpointSecretActionRun>): ReturnType<typeof rotateEndpointSecretActionRun> {
  return audited("webhooks.rotateEndpointSecret", rotateEndpointSecretActionRun, args);
}

export async function deleteEndpointAction(...args: Parameters<typeof deleteEndpointActionRun>): ReturnType<typeof deleteEndpointActionRun> {
  return audited("webhooks.deleteEndpoint", deleteEndpointActionRun, args);
}

export async function saveOutboundAction(...args: Parameters<typeof saveOutboundActionRun>): ReturnType<typeof saveOutboundActionRun> {
  return audited("webhooks.saveOutbound", saveOutboundActionRun, args);
}

export async function deleteOutboundAction(...args: Parameters<typeof deleteOutboundActionRun>): ReturnType<typeof deleteOutboundActionRun> {
  return audited("webhooks.deleteOutbound", deleteOutboundActionRun, args);
}
