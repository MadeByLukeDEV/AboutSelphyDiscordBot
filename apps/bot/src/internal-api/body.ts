import type { IncomingMessage } from "node:http";

export class BodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
  ) {
    super(message);
  }
}

/**
 * Reads a small JSON body. The internal API only ever receives tiny payloads,
 * so the size is capped (a bearer-authenticated client could still be buggy)
 * and the content type is checked. Returns unknown: callers validate with zod.
 */
export async function readJsonBody(req: IncomingMessage, maxBytes = 8 * 1024): Promise<unknown> {
  if (!(req.headers["content-type"] ?? "").toLowerCase().startsWith("application/json")) {
    throw new BodyError("expected application/json", 415);
  }

  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > maxBytes) throw new BodyError("body too large", 413);
    chunks.push(chunk as Buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BodyError("invalid JSON", 400);
  }
}
