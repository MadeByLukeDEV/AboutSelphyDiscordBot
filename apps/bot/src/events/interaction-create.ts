import { Events, MessageFlags, type Client, type Interaction } from "discord.js";
import { moduleOfCommand } from "@aboutselphy/shared/modules";
import { COMMANDS_BY_NAME } from "../commands";
import { log } from "../lib/log";
import { moduleOn } from "../lib/modules";
import { staffLevel } from "../lib/permissions";
import { dispatchComponent } from "./components";

async function handle(interaction: Interaction) {
  if (interaction.isButton() || interaction.isAnySelectMenu() || interaction.isModalSubmit()) {
    await dispatchComponent(interaction);
    return;
  }
  if (interaction.isAutocomplete()) {
    // Suggestions only: no permission check needed, but a failure must never leave the member waiting.
    const handler = COMMANDS_BY_NAME.get(interaction.commandName)?.autocomplete;
    const owner = moduleOfCommand(interaction.commandName);
    if (owner && !(await moduleOn(owner))) return void (await interaction.respond([]).catch(() => undefined));
    if (handler) await handler(interaction).catch((err) => log.warn({ err, command: interaction.commandName }, "autocomplete failed"));
    return;
  }
  if (!interaction.isChatInputCommand()) return;

  const command = COMMANDS_BY_NAME.get(interaction.commandName);
  if (!command) {
    log.warn({ command: interaction.commandName }, "unknown command");
    return;
  }

  const reply = (content: string) =>
    interaction.replied || interaction.deferred
      ? interaction.followUp({ content, flags: MessageFlags.Ephemeral })
      : interaction.reply({ content, flags: MessageFlags.Ephemeral });

  // A feature switched off in the dashboard answers nothing (moderation, /help and /ping have no switch).
  const owner = moduleOfCommand(command.data.name);
  if (owner && !(await moduleOn(owner))) {
    await reply("This feature is switched off right now.");
    return;
  }

  // Checked on every call, never only through Discord's command permissions.
  if (command.requires) {
    const level = staffLevel(interaction.inCachedGuild() ? interaction.member : null);
    const allowed = level === "admin" || (level === "moderator" && command.requires === "moderator");
    if (!allowed) {
      log.warn({ command: command.data.name, user: interaction.user.id }, "command denied");
      await reply("You don't have permission to use this command.");
      return;
    }
  }

  try {
    await command.execute(interaction);
    log.info({ command: command.data.name, user: interaction.user.id }, "command executed");
  } catch (error) {
    // Details stay in the log; the user only sees a generic message.
    log.error({ err: error, command: command.data.name }, "command failed");
    await reply("Something went wrong. Please try again later.").catch(() => undefined);
  }
}

export function registerInteractionCreate(client: Client) {
  client.on(Events.InteractionCreate, (interaction) => {
    void handle(interaction);
  });
}
