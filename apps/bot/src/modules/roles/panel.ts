import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from "discord.js";
import { truncate } from "../../lib/escape";

// The panel message, and what a click on it means. Custom IDs: "rp:<panelId>:<roleId>"
// on a button, "rp:<panelId>" on the menu (the chosen role IDs arrive as its values).

export const PANEL_PREFIX = "rp";

export type PanelView = {
  id: string;
  title: string;
  description: string;
  color: number;
  style: "buttons" | "menu";
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

export function buildPanelMessage(panel: PanelView) {
  const embed = new EmbedBuilder().setColor(panel.color);
  if (panel.title) embed.setTitle(truncate(panel.title, 256));
  const hint = panel.exclusive ? "Pick one: choosing a new one replaces your old choice." : "Press a role to add it. Press it again to remove it.";
  embed.setDescription(truncate([panel.description, panel.description ? "" : null, `*${hint}*`].filter((x) => x !== null).join("\n"), 4000));

  const components =
    panel.style === "menu"
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
                  if (r.emoji) option.setEmoji(r.emoji);
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
                if (r.emoji) button.setEmoji(r.emoji);
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
