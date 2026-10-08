import type {
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
};
