import { Events, type Client, type Guild, type GuildMember, type PartialGuildMember } from "discord.js";
import { env, integrationsActive } from "../../lib/env";
import { log } from "../../lib/log";
import { checkRole } from "../roles";
import { getWelcomeConfig } from "./config";
import { fillCardText } from "@aboutselphy/shared/welcome";
import { fetchAvatar, renderWelcomeCard } from "./card";
import { dmText, goodbyeMessage, pickTemplate, rolesOnJoin, rolesToSnapshot, welcomeMessage, type MemberFacts } from "./message";
import { deleteSnapshot, pruneSnapshots, readCardImage, saveSnapshot, takeSnapshot } from "./repository";

// Joins and leaves. Needs the GuildMembers intent (privileged: switch it on in the Developer
// Portal). Everything is best effort and logged: a failing welcome never blocks the rest, and
// the member's roles are only ever given if the bot may hand them out right now (so a restored
// role can't bring back power the member once had).

const SNAPSHOT_KEEP_DAYS = 90;
/** The last welcome text used, so the same one isn't picked twice in a row. */
let lastTemplate: number | null = null;
const DAY_MS = 86_400_000;

const facts = (m: GuildMember): MemberFacts => ({ id: m.id, username: m.user.username, serverName: m.guild.name, memberCount: m.guild.memberCount });

async function textChannel(guild: Guild, channelId: string | null) {
  if (!channelId) return null;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel && !channel.isDMBased() && channel.guildId === guild.id && channel.isTextBased() && "send" in channel ? channel : null;
}

async function onJoin(member: GuildMember): Promise<void> {
  if (member.guild.id !== env().DISCORD_GUILD_ID || !integrationsActive()) return;
  const config = await getWelcomeConfig();

  // -- roles ------------------------------------------------------------------------------
  try {
    await member.guild.roles.fetch(); // judge roles as they are now
    const auto = member.user.bot ? config.botAutoRoleIds : config.autoRoleIds;
    const restored = config.restoreRoles && !member.user.bot ? await takeSnapshot(member.id) : [];
    const wanted = rolesOnJoin({ auto, restored, already: new Set(member.roles.cache.keys()) });
    const allowed = wanted.filter((id) => checkRole(member.guild, id) === "ok");
    const refused = wanted.filter((id) => !allowed.includes(id));
    if (allowed.length) await member.roles.add(allowed, restored.length ? "Auto-roles and restored roles" : "Auto-roles");
    if (restored.length) await deleteSnapshot(member.id);
    log.info({ user: member.id, bot: member.user.bot, given: allowed, refused, restored: restored.length }, "member joined: roles");
  } catch (err) {
    log.error({ err, user: member.id }, "member joined: giving roles failed");
  }

  if (member.user.bot) return; // bots get roles, not greetings

  // -- messages ---------------------------------------------------------------------------
  if (config.welcomeEnabled) {
    try {
      const channel = await textChannel(member.guild, config.welcomeChannelId);
      const picked = pickTemplate(config.welcomeTemplates, lastTemplate);
      if (!channel) log.warn({ channelId: config.welcomeChannelId }, "welcome channel missing or not a text channel");
      else if (!picked) log.warn({}, "welcome message is on but there is no text saved");
      else {
        lastTemplate = picked.index;
        const who = facts(member);
        // The card is a nicety: if drawing it fails, the welcome goes out without it.
        let card: Uint8Array | null = null;
        if (config.welcomeCardEnabled) {
          try {
            card = await renderWelcomeCard({
              username: member.displayName,
              avatar: await fetchAvatar(member.displayAvatarURL({ extension: "png", size: 256 })),
              title: config.welcomeCardTitle,
              subtitle: fillCardText(config.welcomeCardSubtitle, { username: member.displayName, server: who.serverName, count: String(who.memberCount) }),
              color: config.welcomeColor,
              mode: config.welcomeCardMode === "sticker" ? "sticker" : "background",
              image: await readCardImage(),
            });
          } catch (err) {
            log.error({ err, user: member.id }, "welcome card failed, sending the message without it");
          }
        }
        await channel.send(welcomeMessage(picked.text, who, { asEmbed: config.welcomeAsEmbed, color: config.welcomeColor, imageUrl: config.welcomeImageUrl }, card));
      }
    } catch (err) {
      log.error({ err, user: member.id }, "member joined: welcome message failed");
    }
  }
  if (config.dmEnabled) {
    // DMs are often closed; that is expected, not an error.
    await member.send({ content: dmText(config.dmTemplate, facts(member)), allowedMentions: { parse: [] } }).catch(() => log.info({ user: member.id }, "welcome DM not delivered"));
  }
}

async function onLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.guild.id !== env().DISCORD_GUILD_ID || !integrationsActive()) return;
  const config = await getWelcomeConfig();
  const isBot = member.user?.bot ?? false;

  if (config.restoreRoles && !isBot && member.roles?.cache) {
    try {
      const ids = rolesToSnapshot([...member.roles.cache.values()], member.guild.id);
      if (ids.length) await saveSnapshot(member.id, ids);
    } catch (err) {
      log.error({ err, user: member.id }, "member left: saving roles failed");
    }
  }

  if (config.goodbyeEnabled && !isBot) {
    try {
      const channel = await textChannel(member.guild, config.goodbyeChannelId);
      if (!channel) return void log.warn({ channelId: config.goodbyeChannelId }, "goodbye channel missing or not a text channel");
      await channel.send(goodbyeMessage(config.goodbyeTemplate, { id: member.id, username: member.user?.username ?? "Someone", serverName: member.guild.name, memberCount: member.guild.memberCount }));
    } catch (err) {
      log.error({ err, user: member.id }, "member left: goodbye message failed");
    }
  }
}

export function registerWelcome(client: Client): void {
  client.on(Events.GuildMemberAdd, (member) => void onJoin(member).catch((err) => log.error({ err }, "join handler failed")));
  client.on(Events.GuildMemberRemove, (member) => void onLeave(member).catch((err) => log.error({ err }, "leave handler failed")));

  // Remembered roles are personal data: forget them after a while (at startup and then daily).
  const prune = () => void pruneSnapshots(new Date(Date.now() - SNAPSHOT_KEEP_DAYS * DAY_MS)).then((n) => n && log.info({ removed: n }, "old role snapshots removed")).catch((err) => log.error({ err }, "pruning role snapshots failed"));
  client.once(Events.ClientReady, () => {
    prune();
    setInterval(prune, DAY_MS).unref();
  });
}

/** A sample card for the dashboard's preview, drawn from the saved settings. */
export async function renderPreviewCard(): Promise<Uint8Array> {
  const config = await getWelcomeConfig();
  return renderWelcomeCard({
    username: "NewMember",
    avatar: null,
    title: config.welcomeCardTitle,
    subtitle: fillCardText(config.welcomeCardSubtitle, { username: "NewMember", server: "Your server", count: "1234" }),
    color: config.welcomeColor,
    mode: config.welcomeCardMode === "sticker" ? "sticker" : "background",
    image: await readCardImage(),
  });
}
