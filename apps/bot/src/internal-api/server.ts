import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@aboutselphy/db";
import {
  channelKind,
  refreshCaseBody,
  reloadModule as reloadModuleSchema,
  type BotHealth,
} from "@aboutselphy/shared";
import { getClient } from "../client";
import { env } from "../lib/env";
import { log } from "../lib/log";
import { refreshCaseLog } from "../modules/moderation";
import { BodyError, readJsonBody } from "./body";
import { listGuildChannels } from "./guild";
import { reloadModule } from "./reload";

const VERSION = "0.1.0";
const startedAt = Date.now();

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage): boolean {
  const header = req.headers.authorization ?? "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(env().BOT_API_SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function health(): Promise<BotHealth> {
  const client = getClient();
  let database = false;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    database = true;
  } catch {
    // reported as database: false
  }
  const gatewayReady = client.isReady();
  const ping = client.ws.ping;
  return {
    ok: gatewayReady && database,
    gatewayReady,
    pingMs: ping >= 0 ? ping : null,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    database,
    guildId: env().DISCORD_GUILD_ID,
    version: VERSION,
  };
}

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://internal");

  // Health stays unauthenticated (Docker HEALTHCHECK) and exposes no secrets.
  if (req.method === "GET" && url.pathname === "/health") {
    const body = await health();
    return json(res, body.ok ? 200 : 503, body);
  }

  if (!authorized(req)) {
    log.warn({ path: url.pathname }, "internal api: unauthorized");
    return json(res, 401, { error: "unauthorized" });
  }

  if (req.method === "GET" && url.pathname === "/internal/guild/channels") {
    const kinds = new Set(
      (url.searchParams.get("kinds") ?? "text")
        .split(",")
        .map((k) => channelKind.safeParse(k.trim()))
        .flatMap((r) => (r.success ? [r.data] : [])),
    );
    if (kinds.size === 0) return json(res, 400, { error: "no valid kinds" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { channels: await listGuildChannels(guild, kinds) });
  }

  if (req.method === "POST" && url.pathname === "/internal/moderation/refresh-case") {
    const body = refreshCaseBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await refreshCaseLog(guild, body.data.caseNumber) });
  }

  const reload = /^\/internal\/reload\/([a-z]+)$/.exec(url.pathname);
  if (req.method === "POST" && reload) {
    const module = reloadModuleSchema.safeParse(reload[1]);
    if (!module.success) return json(res, 404, { error: "unknown module" });
    const handlers = await reloadModule(module.data);
    return json(res, 202, { ok: true, handlers });
  }

  return json(res, 404, { error: "not found" });
}

export function startInternalApi(): Server {
  const server = createServer((req, res) => {
    route(req, res).catch((err) => {
      if (err instanceof BodyError) return json(res, err.status, { error: err.message });
      log.error({ err }, "internal api error");
      if (!res.headersSent) json(res, 500, { error: "internal error" });
    });
  });
  const port = env().BOT_API_PORT;
  server.listen(port, "0.0.0.0", () => log.info({ port }, "internal api listening"));
  return server;
}
