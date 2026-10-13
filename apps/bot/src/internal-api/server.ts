import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@aboutselphy/db";
import {
  announcementIdBody,
  giveawayActionBody,
  pollActionBody,
  memberCardPreviewBody,
  feedCheckBody,
  roleDeleteBody,
  webhookRelayBody,
  webhookTestBody,
  stickyClearBody,
  moderationActBody,
  twitchVipUnlinkBody,
  twitchVipLinkedBody,
  roleMergeBody,
  roleUpdateBody,
  roleMoveBody,
  roleCopyBody,
  suggestionDecideBody,
  suggestionMergeBody,
  channelKind,
  refreshCaseBody,
  roleCreateBody,
  rolePanelIdBody,
  reloadModule as reloadModuleSchema,
  twitchResolveBody,
  type BotHealth,
  MEMBER_SEARCH_MIN,
  MEMBER_SEARCH_MAX,
} from "@aboutselphy/shared";
import { getClient } from "../client";
import { env } from "../lib/env";
import { log } from "../lib/log";
import { deleteSent, editSent } from "../modules/announcements";
import { actFromDashboard, refreshCaseLog } from "../modules/moderation";
import { createRole, deletePanelMessage, publishPanel } from "../modules/roles";
import { cancelGiveaway, endGiveaway, startGiveaway } from "../modules/giveaways";
import { deletePollMessage, endPoll, startPoll } from "../modules/polls";
import { renderMemberCardPreview } from "../modules/membercards";
import { checkFeedNow } from "../modules/feeds";
import { clearSticky } from "../modules/sticky";
import { guidePreview, postGuide } from "../modules/modguide";
import { linkVerified, unlinkVip } from "../modules/twitchvip";
import { decideEntry } from "../modules/screening";
import { screeningDecideBody } from "@aboutselphy/shared/screening";
import { postVerificationPanel } from "../modules/verification";
import { relayMessage, sendTest } from "../modules/webhooks";
import { checkCalendar, postMonthly, postOverview, repostEvent } from "../modules/eventcal";
import { eventMonthlyBody, eventRepostBody } from "@aboutselphy/shared/eventcal";
import { copyPermissions, deleteRoles, listManagedRoles, mergeRoles, moveRole, updateRole } from "../modules/roles";
import { decideSuggestion, mergeSuggestion } from "../modules/suggestions";
import { postPanel } from "../modules/tickets";
import { renderPreviewCard } from "../modules/welcome";
import { getTempVoiceOverview } from "../modules/tempvoice";
import { lookupTwitchChannel } from "../modules/twitch";
import { BodyError, readJsonBody } from "./body";
import { listGuildChannels, listGuildEmojis, listGuildRoles } from "./guild";
import { resolveApiHost } from "./host";
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

  if (req.method === "GET" && url.pathname === "/internal/guild/emojis") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { emojis: await listGuildEmojis(guild) });
  }

  if (req.method === "GET" && url.pathname === "/internal/guild/roles") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { roles: await listGuildRoles(guild) });
  }

  if (req.method === "GET" && url.pathname === "/internal/roles/manage") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { roles: await listManagedRoles(guild) });
  }

  if (req.method === "POST" && url.pathname === "/internal/roles/delete") {
    const body = roleDeleteBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { results: await deleteRoles(guild, body.data.ids, body.data.by) });
  }

  if (req.method === "GET" && url.pathname === "/internal/guild/members/search") {
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < MEMBER_SEARCH_MIN || q.length > MEMBER_SEARCH_MAX) return json(res, 400, { error: "invalid query" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    const found = await guild.members.search({ query: q, limit: 10 }).catch(() => null);
    if (!found) return json(res, 502, { error: "search failed" });
    return json(res, 200, { members: [...found.values()].map((m) => ({ id: m.id, username: m.user.username.slice(0, 100), name: m.displayName.slice(0, 100), inServer: true })) });
  }

  if (req.method === "GET" && url.pathname === "/internal/guild/member") {
    const id = url.searchParams.get("id") ?? "";
    if (!/^\d{17,20}$/.test(id)) return json(res, 400, { error: "invalid id" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    const member = await guild.members.fetch(id).catch(() => null);
    return member ? json(res, 200, { member: { id: member.id, name: member.displayName.slice(0, 100) } }) : json(res, 404, { error: "not found" });
  }

  if (req.method === "POST" && url.pathname === "/internal/roles/update") {
    const body = roleUpdateBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await updateRole(guild, body.data, body.data.by) });
  }

  if (req.method === "POST" && url.pathname === "/internal/eventcal/check") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, await checkCalendar(guild));
  }

  if (req.method === "POST" && url.pathname === "/internal/eventcal/repost") {
    const body = eventRepostBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await repostEvent(guild, body.data.id) });
  }

  if (req.method === "POST" && url.pathname === "/internal/eventcal/monthly") {
    const body = eventMonthlyBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await postMonthly(guild, body.data.month) });
  }

  if (req.method === "POST" && url.pathname === "/internal/eventcal/overview") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await postOverview(guild) });
  }

  if (req.method === "POST" && url.pathname === "/internal/roles/move") {
    const body = roleMoveBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await moveRole(guild, body.data, body.data.by) });
  }

  if (req.method === "POST" && url.pathname === "/internal/roles/copy-permissions") {
    const body = roleCopyBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await copyPermissions(guild, body.data, body.data.by) });
  }

  if (req.method === "POST" && url.pathname === "/internal/roles/merge") {
    const body = roleMergeBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, await mergeRoles(guild, body.data, body.data.by));
  }

  if (req.method === "POST" && url.pathname === "/internal/roles/create") {
    const body = roleCreateBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    // `by` is only a label for Discord's audit log; the dashboard passes the staff member's name.
    return json(res, 200, await createRole(guild, body.data, String(url.searchParams.get("by") ?? "dashboard").slice(0, 60)));
  }

  if (req.method === "POST" && (url.pathname === "/internal/rolepanels/publish" || url.pathname === "/internal/rolepanels/delete")) {
    const body = rolePanelIdBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    const status = url.pathname.endsWith("/publish") ? await publishPanel(guild, body.data.id) : await deletePanelMessage(guild, body.data.id);
    return json(res, 200, { status });
  }

  if (req.method === "POST" && url.pathname === "/internal/polls/action") {
    const body = pollActionBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    const { id, action } = body.data;
    const status = action === "start" ? await startPoll(guild, id) : action === "end" ? await endPoll(guild, id) : await deletePollMessage(guild, id);
    return json(res, 200, { status });
  }

  if (req.method === "POST" && url.pathname === "/internal/suggestions/decide") {
    const body = suggestionDecideBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await decideSuggestion(guild, body.data.id, body.data.status, body.data.reason, { id: null, name: body.data.by }) });
  }

  if (req.method === "POST" && url.pathname === "/internal/suggestions/merge") {
    const body = suggestionMergeBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await mergeSuggestion(guild, body.data.id, body.data.targetNumber, { id: null, name: body.data.by }) });
  }

  if (req.method === "POST" && url.pathname === "/internal/giveaways/action") {
    const body = giveawayActionBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    const { id, action } = body.data;
    if (action === "start") return json(res, 200, { status: await startGiveaway(guild, id) });
    if (action === "cancel") return json(res, 200, { status: await cancelGiveaway(guild, id) });
    const result = await endGiveaway(guild, id, action === "reroll");
    return json(res, 200, { status: result.status, winners: result.winners ?? [] });
  }

  if (req.method === "POST" && url.pathname === "/internal/tickets/panel") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await postPanel(guild) });
  }

  if (req.method === "POST" && url.pathname === "/internal/welcome/preview") {
    const png = await renderPreviewCard();
    return json(res, 200, { png: Buffer.from(png).toString("base64") });
  }

  if (req.method === "POST" && url.pathname === "/internal/feeds/check") {
    const body = feedCheckBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    const result = await checkFeedNow(guild, body.data.id);
    return result ? json(res, 200, result) : json(res, 404, { error: "not found" });
  }

  if (req.method === "POST" && url.pathname === "/internal/webhooks/relay") {
    const body = webhookRelayBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await relayMessage(guild, body.data) });
  }

  if (req.method === "POST" && url.pathname === "/internal/webhooks/test") {
    const body = webhookTestBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    return json(res, 200, { status: await sendTest(body.data.id) });
  }

  if (req.method === "POST" && url.pathname === "/internal/verification/panel") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await postVerificationPanel(guild) });
  }

  if (req.method === "POST" && url.pathname === "/internal/screening/decide") {
    const body = screeningDecideBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await decideEntry(guild, body.data.id, body.data.decision, body.data.staffName, null) });
  }

  if (req.method === "POST" && url.pathname === "/internal/twitchvip/linked") {
    const body = twitchVipLinkedBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await linkVerified(guild, body.data) });
  }

  if (req.method === "POST" && url.pathname === "/internal/twitchvip/unlink") {
    const body = twitchVipUnlinkBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await unlinkVip(guild, body.data.id) });
  }

  if (req.method === "GET" && url.pathname === "/internal/modguide/preview") {
    return json(res, 200, await guidePreview());
  }

  if (req.method === "POST" && url.pathname === "/internal/modguide/post") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, await postGuide(guild));
  }

  if (req.method === "POST" && url.pathname === "/internal/sticky/clear") {
    const body = stickyClearBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await clearSticky(guild, body.data.channelId) });
  }

  if (req.method === "POST" && url.pathname === "/internal/membercards/preview") {
    const body = memberCardPreviewBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    try {
      return json(res, 200, { png: Buffer.from(await renderMemberCardPreview(body.data.kind)).toString("base64") });
    } catch {
      return json(res, 500, { error: "could not draw the card" });
    }
  }

  if (req.method === "POST" && url.pathname === "/internal/twitch/resolve") {
    const body = twitchResolveBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    return json(res, 200, await lookupTwitchChannel(body.data.login));
  }

  if (req.method === "GET" && url.pathname === "/internal/tempvoice/overview") {
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, await getTempVoiceOverview(guild));
  }

  if (req.method === "POST" && url.pathname === "/internal/moderation/act") {
    const body = moderationActBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    const result = await actFromDashboard(guild, body.data);
    return json(res, 200, result.ok ? { ok: true, message: result.message, caseNumber: result.caseNumber } : { ok: false, message: result.message });
  }

  if (req.method === "POST" && url.pathname === "/internal/moderation/refresh-case") {
    const body = refreshCaseBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const guild = getClient().guilds.cache.get(env().DISCORD_GUILD_ID);
    if (!guild) return json(res, 503, { error: "guild not available" });
    return json(res, 200, { status: await refreshCaseLog(guild, body.data.caseNumber) });
  }

  if (req.method === "POST" && (url.pathname === "/internal/announcements/edit" || url.pathname === "/internal/announcements/delete")) {
    const body = announcementIdBody.safeParse(await readJsonBody(req));
    if (!body.success) return json(res, 400, { error: "invalid body" });
    const status = url.pathname.endsWith("/edit") ? await editSent(body.data.id) : await deleteSent(body.data.id);
    return json(res, 200, { status });
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
  const { BOT_API_PORT: port, BOT_API_HOST, BOT_ENV } = env();
  const host = resolveApiHost(BOT_ENV, BOT_API_HOST);
  server.listen(port, host, () => log.info({ host, port }, "internal api listening"));
  return server;
}
