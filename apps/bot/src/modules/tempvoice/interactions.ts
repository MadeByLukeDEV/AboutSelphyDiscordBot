import { MessageFlags } from "discord.js";
import { onComponent, type ComponentInteraction } from "../../events/components";
import { env } from "../../lib/env";
import {
  blockFromRoom,
  denyUnlessManager,
  kickFromRoom,
  letIn,
  limitModal,
  loadRoom,
  parseLimitInput,
  renameModal,
  renameRoom,
  roomState,
  setLocked,
  setRoomLimit,
  setSoundboard,
  setVideo,
  transferRoom,
  type Outcome,
} from "./controller";
import { CUSTOM_ID_PREFIX, parsePanelId } from "./panel";

const NO_MENTIONS = { parse: [] as never[] };

/** Private answer (ephemeral): only the person who pressed sees it. */
async function say(i: ComponentInteraction, content: string): Promise<void> {
  const payload = { content, flags: MessageFlags.Ephemeral, allowedMentions: NO_MENTIONS } as const;
  if (i.replied || i.deferred) await i.followUp(payload);
  else await i.reply(payload);
}

/**
 * Every control on a room's panel lands here. Nothing is trusted from the
 * interaction itself: the custom ID is parsed strictly, the room is looked up
 * in our own table, and the controller checks that the person pressing is the
 * owner (or staff) before it changes anything. A button copied into another
 * room, or pressed by someone who just joined, does nothing.
 */
async function handle(i: ComponentInteraction): Promise<void> {
  if (!i.inCachedGuild() || i.guildId !== env().DISCORD_GUILD_ID) return;

  const parsed = parsePanelId(i.customId);
  if (!parsed) return say(i, "That control isn't valid any more.");

  const room = await loadRoom(i.guild, parsed.channelId);
  if (!room) return say(i, "This room doesn't exist any more.");

  const actor = i.member;

  // The two controls that open a form: refuse before showing it, not after.
  if (i.isButton() && (parsed.action === "rename" || parsed.action === "limit")) {
    const denied = denyUnlessManager(room, actor);
    if (denied) return say(i, denied.message);
    return i.showModal(
      parsed.action === "rename" ? renameModal(room.channel.id, room.channel.name) : limitModal(room.channel.id, room.channel.userLimit),
    );
  }

  // The toggles: acknowledge quietly (the panel redraws itself) and only speak up on a refusal.
  if (i.isButton()) {
    await i.deferUpdate();
    const state = await roomState(room);
    let outcome: Outcome;
    switch (parsed.action) {
      case "lock":
        outcome = await setLocked(room, actor, !state.locked);
        break;
      case "video":
        outcome = await setVideo(room, actor, !state.videoAllowed);
        break;
      case "sound":
        outcome = await setSoundboard(room, actor, !state.soundboardAllowed);
        break;
      default:
        return;
    }
    if (!outcome.ok) await say(i, outcome.message);
    return;
  }

  if (i.isUserSelectMenu()) {
    await i.deferUpdate();
    const ids = i.values;
    let outcome: Outcome;
    switch (parsed.action) {
      case "allow":
        outcome = await letIn(room, actor, ids);
        break;
      case "kick":
        outcome = await kickFromRoom(room, actor, ids);
        break;
      case "block":
        outcome = await blockFromRoom(room, actor, ids);
        break;
      case "transfer":
        outcome = await transferRoom(room, actor, ids[0] ?? "");
        break;
      default:
        return;
    }
    await say(i, outcome.message);
    return;
  }

  if (i.isModalSubmit()) {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    if (parsed.action === "rename-modal") {
      const outcome = await renameRoom(room, actor, i.fields.getTextInputValue("name"));
      return void (await say(i, outcome.message));
    }
    if (parsed.action === "limit-modal") {
      const limit = parseLimitInput(i.fields.getTextInputValue("limit"));
      const outcome = limit === null ? { ok: false as const, message: "Enter a whole number from 0 to 99." } : await setRoomLimit(room, actor, limit);
      return void (await say(i, outcome.message));
    }
  }
}

export function registerRoomComponents(): void {
  onComponent(CUSTOM_ID_PREFIX, handle);
}
