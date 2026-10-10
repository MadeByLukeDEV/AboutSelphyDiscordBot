import { ChannelType, Events, type Client, type EmbedBuilder, type Guild, type GuildBasedChannel, type Role } from "discord.js";
import type { LogCategory } from "@aboutselphy/shared/logs";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { logChannelFor } from "./config";
import { channelEmbed, memberJoinEmbed, memberLeaveEmbed, memberRolesEmbed, nicknameEmbed, roleEmbed, voiceEmbed } from "./embeds";

// Server logs: joins and leaves, nickname and role changes, voice, and changes to the server's
// channels and roles. Each kind has its own channel and switch (dashboard). Best effort: a missing
// channel or permission is logged here and never breaks anything else. Needs the GuildMembers
// intent (privileged) for the member events, GuildVoiceStates for voice.

/** Role changes in the first seconds after a join are the auto-roles, not news. */
const RECENT_JOIN_MS = 20_000;
const recentJoins = new Map<string, number>();

const TYPE_NAME: Partial<Record<ChannelType, string>> = {
  [ChannelType.GuildText]: "text",
  [ChannelType.GuildVoice]: "voice",
  [ChannelType.GuildCategory]: "category",
  [ChannelType.GuildAnnouncement]: "announcement",
  [ChannelType.GuildStageVoice]: "stage",
  [ChannelType.GuildForum]: "forum",
  [ChannelType.PublicThread]: "thread",
  [ChannelType.PrivateThread]: "thread",
};

async function post(guild: Guild, category: LogCategory, embed: EmbedBuilder): Promise<void> {
  if (guild.id !== env().DISCORD_GUILD_ID || !integrationsActive()) return;
  const channelId = await logChannelFor(category);
  if (!channelId) return;
  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || channel.isDMBased() || !channel.isTextBased() || !("send" in channel)) {
      log.warn({ category, channelId }, "log channel missing or not a text channel");
      return;
    }
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  } catch (err) {
    log.error({ err, category }, "could not post a log entry");
  }
}

const guarded = (name: string, fn: () => Promise<void>) => void fn().catch((err) => log.error({ err }, `${name} log handler failed`));

export function registerLogs(client: Client): void {
  client.on(Events.GuildMemberAdd, (m) =>
    guarded("join", async () => {
      recentJoins.set(m.id, Date.now());
      setTimeout(() => recentJoins.delete(m.id), RECENT_JOIN_MS * 2).unref();
      await post(m.guild, "members", memberJoinEmbed({ id: m.id, name: m.user.username, createdAt: m.user.createdAt, memberCount: m.guild.memberCount, bot: m.user.bot }));
    }),
  );

  client.on(Events.GuildMemberRemove, (m) =>
    guarded("leave", async () => {
      const roleNames = m.roles?.cache ? [...m.roles.cache.values()].filter((r) => r.id !== m.guild.id).map((r) => r.name) : [];
      await post(m.guild, "members", memberLeaveEmbed({ id: m.id, name: m.user?.username ?? "unknown", joinedAt: m.joinedAt, roleNames, memberCount: m.guild.memberCount }));
    }),
  );

  client.on(Events.GuildMemberUpdate, (before, after) =>
    guarded("member update", async () => {
      if (before.partial) return; // nothing to compare against
      const name = after.user.username;
      if (before.nickname !== after.nickname) {
        await post(after.guild, "memberUpdates", nicknameEmbed({ id: after.id, name, before: before.nickname, after: after.nickname }));
      }
      const had = new Set(before.roles.cache.keys());
      const has = new Set(after.roles.cache.keys());
      const added = [...has].filter((id) => !had.has(id));
      const removed = [...had].filter((id) => !has.has(id));
      const joinedJustNow = Date.now() - (recentJoins.get(after.id) ?? 0) < RECENT_JOIN_MS;
      if ((added.length || removed.length) && !joinedJustNow) {
        const names = (ids: string[]) => ids.map((id) => after.guild.roles.cache.get(id)?.name ?? before.roles.cache.get(id)?.name ?? id);
        await post(after.guild, "memberUpdates", memberRolesEmbed({ id: after.id, name, added: names(added), removed: names(removed) }));
      }
    }),
  );

  client.on(Events.VoiceStateUpdate, (before, after) =>
    guarded("voice", async () => {
      const member = after.member ?? before.member;
      if (!member || member.user.bot || before.channelId === after.channelId) return; // mutes and camera toggles aren't logged
      const kind = !before.channelId ? "join" : !after.channelId ? "leave" : "move";
      await post(after.guild, "voice", voiceEmbed({ id: member.id, name: member.user.username, kind, from: before.channel?.name ?? null, to: after.channel?.name ?? null }));
    }),
  );

  const typeOf = (c: GuildBasedChannel) => TYPE_NAME[c.type] ?? "channel";
  client.on(Events.ChannelCreate, (c) => guarded("channel create", () => post(c.guild, "server", channelEmbed({ kind: "create", name: c.name, type: typeOf(c) }))));
  client.on(Events.ChannelDelete, (c) => {
    if (!c.isDMBased()) guarded("channel delete", () => post(c.guild, "server", channelEmbed({ kind: "delete", name: c.name, type: typeOf(c) })));
  });
  client.on(Events.ChannelUpdate, (before, after) => {
    if (before.isDMBased() || after.isDMBased() || before.name === after.name) return;
    guarded("channel update", () => post(after.guild, "server", channelEmbed({ kind: "rename", name: after.name, before: before.name, type: typeOf(after) })));
  });

  client.on(Events.GuildRoleCreate, (r) => guarded("role create", () => post(r.guild, "server", roleEmbed({ kind: "create", name: r.name }))));
  client.on(Events.GuildRoleDelete, (r) => guarded("role delete", () => post(r.guild, "server", roleEmbed({ kind: "delete", name: r.name }))));
  client.on(Events.GuildRoleUpdate, (before: Role, after: Role) => {
    const permissionsChanged = before.permissions.bitfield !== after.permissions.bitfield;
    const colorChanged = before.color !== after.color;
    if (before.name === after.name && !permissionsChanged && !colorChanged) return; // position moves are noise
    guarded("role update", () => post(after.guild, "server", roleEmbed({ kind: "update", name: after.name, before: before.name, permissionsChanged, colorChanged })));
  });
}
