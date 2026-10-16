import { NextResponse } from "next/server";
import { receiveWebhook } from "@/modules/webhooks";

export const dynamic = "force-dynamic";

// Public on purpose (/api is outside the sign-in gate): authentication is the HMAC signature checked in
// receiveWebhook. Nothing about the answer depends on whether the id exists, beyond a plain 401.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const length = request.headers.get("content-length");
  // Never read more than the biggest limit (GitHub endpoints), whatever the client claims; smaller providers are cut down after authentication.
  const reader = request.body?.getReader();
  let rawBody = "";
  if (reader) {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 128 * 1024) {
        await reader.cancel().catch(() => undefined);
        return NextResponse.json({ ok: false, error: "too large" }, { status: 413 });
      }
      chunks.push(value);
    }
    rawBody = Buffer.concat(chunks).toString("utf8");
  }
  const result = await receiveWebhook({
    id,
    rawBody,
    contentLength: length !== null && /^\d+$/.test(length) ? Number(length) : null,
    timestamp: request.headers.get("x-webhook-timestamp"),
    signature: request.headers.get("x-webhook-signature"),
    githubSignature: request.headers.get("x-hub-signature-256"),
    githubEvent: request.headers.get("x-github-event"),
    deliveryId: request.headers.get("x-github-delivery"),
    stripeSignature: request.headers.get("stripe-signature"),
    ip: request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
  });
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
}
