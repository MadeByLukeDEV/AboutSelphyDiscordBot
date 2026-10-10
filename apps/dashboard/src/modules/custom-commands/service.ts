import "server-only";
import { MAX_CUSTOM_COMMANDS, type CustomCommandInput } from "@aboutselphy/shared/custom-commands";
import { errorInfo } from "@/lib/log";
import { reloadBotModule } from "@/modules/bot-api";
import { countCommands, createCommand, deleteCommand, findByName, findCommand, listCommands, updateCommand } from "./repository";
import type { CustomCommandRow, SaveCustomCommandResult } from "./schema";

export async function getCustomCommandsPage(): Promise<{ commands: CustomCommandRow[] }> {
  const rows = await listCommands();
  return { commands: rows.map((r) => ({ id: r.id, name: r.name, response: r.response, ephemeral: r.ephemeral, enabled: r.enabled, uses: r.uses, createdByName: r.createdByName })) };
}

/** Adds (no id) or changes (with id; the name stays) a custom command and asks the bot to drop its name cache. */
export async function saveCustomCommand(input: CustomCommandInput, byName: string): Promise<SaveCustomCommandResult> {
  try {
    if (input.id) {
      const existing = await findCommand(input.id);
      if (!existing) return { ok: false, error: "notFound" };
      await updateCommand(existing.id, { response: input.response, ephemeral: input.ephemeral, enabled: input.enabled });
    } else {
      if ((await countCommands()) >= MAX_CUSTOM_COMMANDS) return { ok: false, error: "tooMany" };
      if (await findByName(input.name)) return { ok: false, error: "alreadyExists" };
      await createCommand({ name: input.name, response: input.response, ephemeral: input.ephemeral, enabled: input.enabled, createdByName: byName.slice(0, 100) });
    }
    return { ok: true, botNotified: await reloadBotModule("customcommands") };
  } catch (error) {
    console.error("[custom-commands] saving failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}

export async function removeCustomCommand(id: string): Promise<SaveCustomCommandResult> {
  try {
    if ((await deleteCommand(id)) === 0) return { ok: false, error: "notFound" };
    return { ok: true, botNotified: await reloadBotModule("customcommands") };
  } catch (error) {
    console.error("[custom-commands] removing failed", errorInfo(error));
    return { ok: false, error: "failed" };
  }
}
