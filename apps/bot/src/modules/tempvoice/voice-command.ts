import { InteractionContextType, MessageFlags, SlashCommandBuilder, type GuildMember } from "discord.js";
import type { Command } from "../../commands/types";
import {
  blockFromRoom,
  claimRoom,
  denyUnlessManager,
  kickFromRoom,
  letIn,
  postPanel,
  removeFromList,
  renameRoom,
  roomOfMember,
  roomState,
  setLocked,
  setRoomLimit,
  setSoundboard,
  setVideo,
  transferRoom,
  type Outcome,
  type Room,
} from "./controller";

const NO_MENTIONS = { parse: [] as never[] };

const userOption = (o: import("discord.js").SlashCommandUserOption, description: string) =>
  o.setName("user").setDescription(description).setRequired(true);

async function describeRoom(room: Room): Promise<string> {
  const s = await roomState(room);
  const list = (ids: string[]) => (ids.length ? ids.map((id) => `<@${id}>`).join(" ") : "nobody");
  return [
    `**${room.channel.name}**, owned by <@${room.ownerId}>`,
    `Access: ${s.locked ? "locked" : "open"} · Limit: ${s.userLimit === 0 ? "none" : s.userLimit}`,
    `Video: ${s.videoAllowed ? "on" : "off"} · Soundboard: ${s.soundboardAllowed ? "on" : "off"}`,
    `Let in: ${list(s.allowedIds)}`,
    `Blocked: ${list(s.blockedIds)}`,
  ].join("\n");
}

/**
 * /voice is open to every member on purpose (no staff requirement and no
 * default-permission hiding): it acts only on the temporary room the member is
 * sitting in, and the controller refuses anyone who isn't that room's owner (or
 * staff). Discord's own command permissions are not the security boundary.
 */
const voice: Command = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Manage your temporary voice room")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((s) => s.setName("info").setDescription("Show your room's settings"))
    .addSubcommand((s) => s.setName("panel").setDescription("Post the control panel in the room's chat again"))
    .addSubcommand((s) =>
      s.setName("name").setDescription("Rename the room (Discord allows 2 renames per 10 minutes)").addStringOption((o) =>
        o.setName("name").setDescription("The new name").setRequired(true).setMaxLength(100),
      ),
    )
    .addSubcommand((s) =>
      s.setName("limit").setDescription("Set how many members fit").addIntegerOption((o) =>
        o.setName("members").setDescription("0 = no limit").setRequired(true).setMinValue(0).setMaxValue(99),
      ),
    )
    .addSubcommand((s) => s.setName("lock").setDescription("Only people you let in can join"))
    .addSubcommand((s) => s.setName("unlock").setDescription("Let everyone join again"))
    .addSubcommand((s) =>
      s.setName("video").setDescription("Allow or stop video and screen sharing").addBooleanOption((o) =>
        o.setName("enabled").setDescription("On or off").setRequired(true),
      ),
    )
    .addSubcommand((s) =>
      s.setName("soundboard").setDescription("Allow or stop the soundboard").addBooleanOption((o) =>
        o.setName("enabled").setDescription("On or off").setRequired(true),
      ),
    )
    .addSubcommand((s) => s.setName("allow").setDescription("Let someone join, even when locked").addUserOption((o) => userOption(o, "Who to let in")))
    .addSubcommand((s) => s.setName("remove").setDescription("Take someone off the list").addUserOption((o) => userOption(o, "Who to remove")))
    .addSubcommand((s) => s.setName("kick").setDescription("Remove someone from the room").addUserOption((o) => userOption(o, "Who to remove")))
    .addSubcommand((s) => s.setName("block").setDescription("Remove someone and stop them rejoining").addUserOption((o) => userOption(o, "Who to block")))
    .addSubcommand((s) => s.setName("unblock").setDescription("Let a blocked person join again").addUserOption((o) => userOption(o, "Who to unblock")))
    .addSubcommand((s) => s.setName("transfer").setDescription("Give the room to someone in it").addUserOption((o) => userOption(o, "The new owner")))
    .addSubcommand((s) => s.setName("claim").setDescription("Take over a room whose owner has left"))
    .toJSON(),
  // No `requires`: see the note above.
  async execute(i) {
    if (!i.inCachedGuild()) return;
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const reply = async (content: string): Promise<void> => {
      await i.editReply({ content, allowedMentions: NO_MENTIONS });
    };
    const actor: GuildMember = i.member;

    const room = await roomOfMember(actor);
    if (!room) {
      await reply("Join one of your temporary voice rooms first, then try again.");
      return;
    }

    const sub = i.options.getSubcommand();
    const run = async (outcome: Promise<Outcome>) => reply((await outcome).message);
    const target = () => i.options.getUser("user", true).id;

    switch (sub) {
      case "info":
        await reply(await describeRoom(room));
        return;
      case "panel": {
        const denied = denyUnlessManager(room, actor);
        if (denied) return void (await reply(denied.message));
        await postPanel(room);
        return void (await reply("Posted a fresh control panel in the room's chat."));
      }
      case "name":
        return run(renameRoom(room, actor, i.options.getString("name", true)));
      case "limit":
        return run(setRoomLimit(room, actor, i.options.getInteger("members", true)));
      case "lock":
        return run(setLocked(room, actor, true));
      case "unlock":
        return run(setLocked(room, actor, false));
      case "video":
        return run(setVideo(room, actor, i.options.getBoolean("enabled", true)));
      case "soundboard":
        return run(setSoundboard(room, actor, i.options.getBoolean("enabled", true)));
      case "allow":
        return run(letIn(room, actor, [target()]));
      case "remove":
        return run(removeFromList(room, actor, [target()], "remove"));
      case "kick":
        return run(kickFromRoom(room, actor, [target()]));
      case "block":
        return run(blockFromRoom(room, actor, [target()]));
      case "unblock":
        return run(removeFromList(room, actor, [target()], "unblock"));
      case "transfer":
        return run(transferRoom(room, actor, target()));
      case "claim":
        return run(claimRoom(room, actor));
    }
  },
};

export const voiceCommands: Command[] = [voice];
