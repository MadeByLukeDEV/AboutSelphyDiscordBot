import { Events, type Client, type Guild, type GuildMember, type Message } from "discord.js";
import { applyBoost, boostPercent, fillLevelTemplate, levelFromXp } from "@aboutselphy/shared/levels";
import { withEmotes } from "../../lib/emotes";
import { env, integrationsActive } from "../../lib/env";
import { escapeText } from "../../lib/escape";
import { log } from "../../lib/log";
import { moduleOn } from "../../lib/modules";
import { checkRole } from "../roles";
import { getLevelConfig } from "./config";
import { addXp } from "./repository";
import { cooldownPassed, earnsXp, planRewardRoles, rollXp } from "./rules";

// XP from messages (random amount, once per cooldown) and from time in voice (a fixed amount a
// minute while with someone else). Levels come from the MEE6 curve; reaching one can give a role.
// Only runs in production or with BOT_INTEGRATIONS_IN_DEV (two processes on one token would count
// every message twice). Needs the GuildMessages intent (not privileged: message text is not read).

const VOICE_TICK_MS = 60_000;
const lastMessageXp = new Map<string, number>();

/** Gives a member their reward roles for `level` and takes back the ones above it. Every role is checked with the same safety rule as role panels. */
export async function syncRewardRoles(member: GuildMember, level: number): Promise<{ added: string[]; removed: string[] }> {
  const { config, rewards } = await getLevelConfig();
  const plan = planRewardRoles({ rewards, level, stack: config.stackRoles, held: new Set(member.roles.cache.keys()) });
  await member.guild.roles.fetch();
  const add = plan.add.filter((id) => checkRole(member.guild, id) === "ok");
  const remove = plan.remove.filter((id) => member.guild.roles.cache.has(id));
  if (add.length) await member.roles.add(add, `Level ${level} reward`);
  if (remove.length) await member.roles.remove(remove, `Level ${level}: reward role no longer reached`);
  if (plan.add.length !== add.length) log.warn({ user: member.id, refused: plan.add.filter((id) => !add.includes(id)) }, "a level reward role can't be handed out");
  return { added: add, removed: remove };
}

async function announce(member: GuildMember, level: number, where: { channelId: string | null; here: Message["channel"] | null }): Promise<void> {
  const { config } = await getLevelConfig();
  if (config.announce === "off") return;
  const text = withEmotes(fillLevelTemplate(config.announceTemplate, { user: `<@${member.id}>`, username: escapeText(member.user.username), level: String(level) }));
  const payload = { content: text.slice(0, 2000), allowedMentions: { parse: [] as never[], users: [member.id] } };
  try {
    if (config.announce === "same" && where.here && "send" in where.here) await where.here.send(payload);
    else {
      const id = config.announce === "channel" ? config.announceChannelId : where.channelId;
      const channel = id ? await member.guild.channels.fetch(id).catch(() => null) : null;
      if (channel && !channel.isDMBased() && channel.isTextBased() && "send" in channel) await channel.send(payload);
    }
  } catch (err) {
    log.warn({ err, user: member.id }, "could not announce a level-up");
  }
}

async function handleLevelUp(member: GuildMember, level: number, here: Message["channel"] | null): Promise<void> {
  try {
    await syncRewardRoles(member, level);
  } catch (err) {
    log.error({ err, user: member.id, level }, "level reward roles failed");
  }
  await announce(member, level, { channelId: null, here });
  log.info({ user: member.id, level }, "level up");
}

async function onMessage(message: Message): Promise<void> {
  if (!message.inGuild() || message.guildId !== env().DISCORD_GUILD_ID || message.author.bot || message.webhookId || message.system || !message.member) return;
  if (!(await moduleOn("levels"))) return;
  const { config, boosts } = await getLevelConfig();
  if (!config.enabled) return;

  const roleIds = new Set(message.member.roles.cache.keys());
  if (!earnsXp({ channelId: message.channelId, parentId: "parentId" in message.channel ? (message.channel.parentId ?? null) : null, memberRoleIds: roleIds, noXpChannelIds: config.noXpChannelIds, noXpRoleIds: config.noXpRoleIds })) return;

  const now = Date.now();
  if (!cooldownPassed(lastMessageXp.get(message.author.id), now, config.cooldownSeconds)) return;
  lastMessageXp.set(message.author.id, now);

  const amount = applyBoost(rollXp(config.xpMin, config.xpMax), boostPercent(roleIds, boosts));
  const { before, after } = await addXp(message.author.id, amount, message.member.displayName, { messages: 1 });
  if (levelFromXp(after) > levelFromXp(before)) await handleLevelUp(message.member, levelFromXp(after), message.channel);
}

/** One minute of voice XP for everyone who is in a voice channel with someone else. */
async function voiceTick(guild: Guild): Promise<void> {
  if (!(await moduleOn("levels"))) return;
  const { config, boosts } = await getLevelConfig();
  if (!config.enabled || config.voiceXpPerMinute <= 0) return;

  const byChannel = new Map<string, GuildMember[]>();
  for (const state of guild.voiceStates.cache.values()) {
    if (!state.channelId || !state.member || state.member.user.bot) continue;
    if (state.channelId === guild.afkChannelId) continue;
    (byChannel.get(state.channelId) ?? byChannel.set(state.channelId, []).get(state.channelId)!).push(state.member);
  }
  for (const [channelId, members] of byChannel) {
    if (members.length < 2) continue; // alone in a channel earns nothing
    const channel = guild.channels.cache.get(channelId);
    for (const member of members) {
      const state = member.voice;
      if (state.selfDeaf || state.serverDeaf) continue;
      const roleIds = new Set(member.roles.cache.keys());
      if (!earnsXp({ channelId, parentId: channel?.parentId ?? null, memberRoleIds: roleIds, noXpChannelIds: config.noXpChannelIds, noXpRoleIds: config.noXpRoleIds })) continue;
      try {
        const { before, after } = await addXp(member.id, applyBoost(config.voiceXpPerMinute, boostPercent(roleIds, boosts)), member.displayName, { voiceMinutes: 1 });
        if (levelFromXp(after) > levelFromXp(before)) await handleLevelUp(member, levelFromXp(after), null);
      } catch (err) {
        log.error({ err, user: member.id }, "voice XP failed");
      }
    }
  }
}

let timer: ReturnType<typeof setInterval> | undefined;

export function registerLevels(client: Client): void {
  if (!integrationsActive()) {
    log.info({}, "levels: not starting (local run without BOT_INTEGRATIONS_IN_DEV)");
    return;
  }
  client.on(Events.MessageCreate, (message) => void onMessage(message).catch((err) => log.error({ err }, "level message handler failed")));
  client.once(Events.ClientReady, () => {
    timer = setInterval(() => {
      const guild = client.guilds.cache.get(env().DISCORD_GUILD_ID);
      if (guild) void voiceTick(guild).catch((err) => log.error({ err }, "voice XP round failed"));
    }, VOICE_TICK_MS);
    // The cooldown map only needs recent entries.
    setInterval(() => {
      const cutoff = Date.now() - 3_600_000;
      for (const [id, at] of lastMessageXp) if (at < cutoff) lastMessageXp.delete(id);
    }, 600_000).unref();
  });
}

export function stopLevels(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}
