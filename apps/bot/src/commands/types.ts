import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { StaffLevel } from "../lib/permissions";

export type Command = {
  /** Slash command definition (`new SlashCommandBuilder()....toJSON()`). */
  data: RESTPostAPIChatInputApplicationCommandsJSONBody;
  /**
   * Minimum staff level, enforced in code on every call. Discord-side command
   * permissions are only a UI hint and can be changed by server admins.
   */
  requires?: StaffLevel;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** Suggestions for an option marked `setAutocomplete(true)`. Never throws to the caller; keep it fast (3 s limit). */
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
};
