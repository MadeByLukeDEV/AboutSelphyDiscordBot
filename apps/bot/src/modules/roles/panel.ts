import { withEmotes } from "../../lib/emotes";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { isAllowedImageUrl } from "@aboutselphy/shared/announcement";
import { parseEmoji } from "@aboutselphy/shared/role-panel";
import { truncate } from "../../lib/escape";

// The panel message, and what a click on it means. Custom IDs: "rp:<panelId>:<roleId>"
// on a button, "rp:<panelId>" on the menu (the chosen role IDs arrive as its values).

export const PANEL_PREFIX = "rp";

export type PanelView = {
  id: string;
  title: string;
  description: string;
  color: number;
  imageUrl: string;
  style: "buttons" | "menu" | "reactions";
  exclusive: boolean;
  roles: Array<{ roleId: string; label: string; emoji: string; description: string }>;
};

export function buttonId(panelId: string, roleId: string): string {
  return `${PANEL_PREFIX}:${panelId}:${roleId}`;
}

export function menuId(panelId: string): string {
  return `${PANEL_PREFIX}:${panelId}`;
}

/** Strict parse: only our own shape, with ID-looking parts. */
export function parsePanelCustomId(customId: string): { panelId: string; roleId: string | null } | null {
  const match = /^rp:([a-z0-9]{10,40})(?::(\d{17,20}))?$/.exec(customId);
  return match ? { panelId: match[1]!, roleId: match[2] ?? null } : null;
}

/** An emoji as discord.js wants it for a button or menu option: the unicode text, or {id, name, animated}. */
export function toComponentEmoji(value: string): string | { id: string; name: string; animated: boolean } | undefined {
  const parsed = parseEmoji(value);
  if (!parsed) return undefined;
  return parsed.kind === "unicode" ? parsed.name : { id: parsed.id, name: parsed.name, animated: parsed.animated };
}

/** The same emoji as a reaction identifier ("name:id" for a server emote, the character otherwise). */
export function toReactionIdentifier(value: string): string | undefined {
  const parsed = parseEmoji(value);
  if (!parsed) return undefined;
  return parsed.kind === "unicode" ? parsed.name : `${parsed.name}:${parsed.id}`;
}

/** Does a reaction's emoji match a stored one? A server emote matches by id (its name can change). */
export function emojiMatches(stored: string, reaction: { id: string | null; name: string | null }): boolean {
  const parsed = parseEmoji(stored);
  if (!parsed) return false;
  return parsed.kind === "custom" ? reaction.id === parsed.id : reaction.id === null && reaction.name === parsed.name;
}

export function buildPanelMessage(panel: PanelView) {
  const embed = new EmbedBuilder().setColor(panel.color);
  if (panel.title) embed.setTitle(truncate(withEmotes(panel.title), 256));
  // Re-checked here: the row is trusted, but a bad address must never reach Discord.
  if (panel.imageUrl && isAllowedImageUrl(panel.imageUrl)) embed.setImage(panel.imageUrl);
  const reactions = panel.style === "reactions";
  const hint = reactions
    ? panel.exclusive
      ? "React with an emoji to pick one. Reacting with another replaces your choice; removing your reaction removes the role."
      : "React with an emoji to get the role. Remove your reaction to give it back."
    : panel.exclusive
      ? "Pick one: choosing a new one replaces your old choice."
      : "Press a role to add it. Press it again to remove it.";
  // A reaction panel has no buttons, so the message itself lists which emoji gives which role.
  const legend = reactions ? panel.roles.map((r) => `${r.emoji} ${r.label}`).join("\n") : null;
  embed.setDescription(truncate(withEmotes([panel.description, legend, `*${hint}*`].filter((x) => x).join("\n\n")), 4000));

  const components =
    panel.style === "reactions"
      ? []
      : panel.style === "menu"
        ? [
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(menuId(panel.id))
              .setPlaceholder("Choose roles to add or remove")
              .setMinValues(1)
              .setMaxValues(panel.exclusive ? 1 : Math.min(25, panel.roles.length))
              .addOptions(
                panel.roles.map((r) => {
                  const option = new StringSelectMenuOptionBuilder().setLabel(truncate(r.label, 100)).setValue(r.roleId);
                  if (r.description) option.setDescription(truncate(r.description, 100));
                  const emoji = toComponentEmoji(r.emoji);
                  if (emoji) option.setEmoji(emoji);
                  return option;
                }),
              ),
          ),
        ]
      : chunk(panel.roles, 5)
          .slice(0, 5)
          .map((row) =>
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              row.map((r) => {
                const button = new ButtonBuilder().setCustomId(buttonId(panel.id, r.roleId)).setLabel(truncate(r.label, 80)).setStyle(ButtonStyle.Secondary);
                const emoji = toComponentEmoji(r.emoji);
                if (emoji) button.setEmoji(emoji);
                return button;
              }),
            ),
          );

  // Nothing typed into a panel can ping anyone.
  return { content: "", embeds: [embed], components, allowedMentions: { parse: [] as never[] } };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * What one click changes. Each chosen role that is held is removed, each one that isn't is
 * added. On an "exclusive" panel a new choice replaces every other role of the panel the
 * member holds, so they hold at most one.
 */
export function planToggle(input: { held: ReadonlySet<string>; chosen: string[]; panelRoleIds: string[]; exclusive: boolean }): { add: string[]; remove: string[] } {
  const inPanel = new Set(input.panelRoleIds);
  const chosen = [...new Set(input.chosen)].filter((id) => inPanel.has(id));
  const add: string[] = [];
  const remove: string[] = [];

  if (input.exclusive) {
    const pick = chosen[0];
    if (!pick) return { add, remove };
    if (input.held.has(pick)) return { add, remove: [pick] };
    for (const id of input.panelRoleIds) if (input.held.has(id)) remove.push(id);
    return { add: [pick], remove };
  }
  for (const id of chosen) (input.held.has(id) ? remove : add).push(id);
  return { add, remove };
}
