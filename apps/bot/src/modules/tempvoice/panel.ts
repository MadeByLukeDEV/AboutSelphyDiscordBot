import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  UserSelectMenuBuilder,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import type { RoomState } from "./state";

/** Everything the panel's components can ask for. */
export const PANEL_ACTIONS = [
  "rename",
  "limit",
  "lock",
  "video",
  "sound",
  "allow",
  "kick",
  "transfer",
  "block",
  "rename-modal",
  "limit-modal",
] as const;
export type PanelAction = (typeof PANEL_ACTIONS)[number];

export const CUSTOM_ID_PREFIX = "tv";

/** "tv:lock:123456789012345678". Discord allows 100 characters; this is about 30. */
export function panelId(action: PanelAction, channelId: string): string {
  return `${CUSTOM_ID_PREFIX}:${action}:${channelId}`;
}

/** Strict parse: anything that isn't exactly our format (or names an unknown action) is null. */
export function parsePanelId(customId: string): { action: PanelAction; channelId: string } | null {
  const match = /^tv:([a-z-]+):(\d{17,20})$/.exec(customId);
  const action = match?.[1] as PanelAction | undefined;
  if (!match || !action || !PANEL_ACTIONS.includes(action)) return null;
  return { action, channelId: match[2]! };
}

const MAX_LISTED = 10;

function mentionList(ids: readonly string[]): string {
  if (ids.length === 0) return "Nobody";
  const shown = ids.slice(0, MAX_LISTED).map((id) => `<@${id}>`);
  const more = ids.length - shown.length;
  return more > 0 ? `${shown.join(" ")} and ${more} more` : shown.join(" ");
}

export type PanelData = { channelId: string; ownerId: string; state: RoomState };

/**
 * The control panel posted in the room's chat. It only ever contains IDs we
 * made ourselves, mentions (which embeds never ping) and fixed text, so no
 * member-supplied text can end up in it.
 */
export function buildPanel({ channelId, ownerId, state }: PanelData) {
  const embed = new EmbedBuilder()
    .setColor(0x00ffa8)
    .setTitle("Room controls")
    .setDescription(`Only <@${ownerId}> can change this room. If they leave, anyone in the room can take over with \`/voice claim\`.`)
    .addFields(
      {
        name: "Access",
        value: state.locked ? "Locked: only people on the list can join" : "Open to everyone",
        inline: true,
      },
      { name: "Member limit", value: state.userLimit === 0 ? "No limit" : String(state.userLimit), inline: true },
      { name: "Video", value: state.videoAllowed ? "On" : "Off", inline: true },
      { name: "Soundboard", value: state.soundboardAllowed ? "On" : "Off", inline: true },
      { name: "Let in", value: mentionList(state.allowedIds) },
      { name: "Blocked", value: mentionList(state.blockedIds) },
    );

  const toggle = (action: PanelAction, label: string, on: boolean) =>
    new ButtonBuilder()
      .setCustomId(panelId(action, channelId))
      .setLabel(label)
      .setStyle(on ? ButtonStyle.Success : ButtonStyle.Secondary);

  const buttons = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder().setCustomId(panelId("rename", channelId)).setLabel("Rename").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(panelId("limit", channelId)).setLabel("Member limit").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(panelId("lock", channelId))
      .setLabel(state.locked ? "Unlock room" : "Lock room")
      .setStyle(state.locked ? ButtonStyle.Danger : ButtonStyle.Secondary),
    toggle("video", state.videoAllowed ? "Video: on" : "Video: off", state.videoAllowed),
    toggle("sound", state.soundboardAllowed ? "Soundboard: on" : "Soundboard: off", state.soundboardAllowed),
  );

  // A select menu takes a whole row, so each user action gets its own.
  const select = (action: PanelAction, placeholder: string, max: number) =>
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(panelId(action, channelId))
        .setPlaceholder(placeholder)
        .setMinValues(1)
        .setMaxValues(max),
    );

  return {
    embeds: [embed],
    components: [
      buttons,
      select("allow", "Let someone in…", 5),
      select("kick", "Remove someone from the room…", 5),
      select("block", "Block someone from joining…", 5),
      select("transfer", "Give the room to…", 1),
    ],
  };
}
