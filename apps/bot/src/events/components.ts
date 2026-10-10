import {
  MessageFlags,
  type AnySelectMenuInteraction,
  type ButtonInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { log } from "../lib/log";

export type ComponentInteraction = ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction;
type Handler = (interaction: ComponentInteraction) => Promise<void>;

// Buttons, select menus and modals carry a customId. Each module owns a prefix
// ("tv:..." for temporary voice rooms) and registers one handler for it, so the
// router never needs to know what any module's controls do.
const handlers = new Map<string, Handler>();

export function onComponent(prefix: string, handler: Handler): void {
  if (handlers.has(prefix)) throw new Error(`component prefix "${prefix}" is already registered`);
  handlers.set(prefix, handler);
}

export async function dispatchComponent(interaction: ComponentInteraction): Promise<void> {
  const prefix = interaction.customId.split(":")[0] ?? "";
  const handler = handlers.get(prefix);
  if (!handler) {
    log.warn({ prefix }, "component interaction without a handler");
    return;
  }
  try {
    await handler(interaction);
  } catch (err) {
    // The member sees a generic message; the details stay in the log.
    log.error({ err, prefix, user: interaction.user.id }, "component interaction failed");
    const payload = { content: "Something went wrong. Please try again.", flags: MessageFlags.Ephemeral } as const;
    if (interaction.replied || interaction.deferred) await interaction.followUp(payload).catch(() => undefined);
    else await interaction.reply(payload).catch(() => undefined);
  }
}
