import { Events, type Client, type Guild, type GuildMember } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { KeyedMutex } from "../../lib/keyed-mutex";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { recordJoin, markLeft } from "./repository";
import { detectInvite, snapshotOf, type Detected, type InviteInfo, type Snapshot } from "./rules";

// Invite tracking. Discord never says which invite a new member used, so the bot keeps the use counts of every invite and
// compares them when someone joins (and the custom URL's count, if the server has one). Needs the GuildInvites intent (not
// privileged) and the Manage Server permission to read invites; without that permission it logs a warning once and stays quiet.
// Joins are handled one at a time, because two joins at once can't be told apart from one set of counts.

const mutex = new KeyedMutex();
let known: Snapshot = new Map();
let vanityUses: number | null = null;
let warnedPermission = false;

async function readInvites(guild: Guild): Promise<{ list: InviteInfo[]; vanity: number | null } | null> {
  try {
    const fetched = await guild.invites.fetch();
    const list = [...fetched.values()].map((i) => ({ code: i.code, uses: i.uses ?? 0, maxUses: i.maxUses ?? 0, inviterId: i.inviter?.id ?? null }));
    let vanity: number | null = null;
    if (guild.features.includes("VANITY_URL")) vanity = (await guild.fetchVanityData().catch(() => null))?.uses ?? null;
    return { list, vanity };
  } catch (err) {
    if (!warnedPermission) {
      warnedPermission = true;
      log.warn({ err }, "invites: can't read the server's invites (the bot needs the Manage Server permission)");
    }
    return null;
  }
}

async function refresh(guild: Guild): Promise<void> {
  const now = await readInvites(guild);
  if (!now) return;
  known = snapshotOf(now.list);
  vanityUses = now.vanity;
}

export type JoinInfo = { detected: Detected; inviterName: string | null };

/**
 * A member joined: works out which invite they used, remembers it, and returns what the join log can show (or null when
 * tracking is off or can't read invites). Never throws.
 */
export function trackJoin(member: GuildMember): Promise<JoinInfo | null> {
  if (member.guild.id !== env().DISCORD_GUILD_ID || member.user.bot) return Promise.resolve(null);
  return mutex.run("join", async () => {
    try {
      if (!integrationsActive() || !(await moduleOn("invites"))) return null;
      const now = await readInvites(member.guild);
      if (!now) return null;
      const detected = detectInvite(known, now.list, vanityUses !== null && now.vanity !== null ? { before: vanityUses, after: now.vanity } : null);
      known = snapshotOf(now.list);
      vanityUses = now.vanity;

      const inviter = detected.source === "invite" && detected.inviterId ? await member.guild.members.fetch(detected.inviterId).catch(() => null) : null;
      const inviterName = inviter?.user.username ?? null;
      await recordJoin({
        userId: member.id,
        userName: member.user.username,
        inviterId: detected.source === "invite" ? detected.inviterId : null,
        inviterName,
        code: detected.source === "invite" ? detected.code : null,
        source: detected.source,
      });
      log.info({ user: member.id, source: detected.source, code: detected.source === "invite" ? detected.code : undefined }, "invites: join recorded");
      return { detected, inviterName };
    } catch (err) {
      log.error({ err }, "invites: could not track a join");
      return null;
    }
  });
}

/** Keeps the invite list current and notes who leaves. Off in a local run unless BOT_INTEGRATIONS_IN_DEV=true. */
export function startInvites(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "invites: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.once(Events.ClientReady, () => {
    const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
    if (guild) void refresh(guild).then(() => log.info({ invites: known.size }, "invites: ready"));
  });
  // Invites made or removed between joins keep the counts right.
  client.on(Events.InviteCreate, (invite) => {
    if (invite.guild?.id !== env().DISCORD_GUILD_ID) return;
    void mutex.run("join", async () => {
      known = new Map(known).set(invite.code, { code: invite.code, uses: invite.uses ?? 0, maxUses: invite.maxUses ?? 0, inviterId: invite.inviter?.id ?? null });
    });
  });
  client.on(Events.GuildMemberRemove, (member) => {
    if (member.guild.id !== env().DISCORD_GUILD_ID) return;
    void markLeft(member.id).catch((err) => log.warn({ err }, "invites: could not note a leave"));
  });
}
