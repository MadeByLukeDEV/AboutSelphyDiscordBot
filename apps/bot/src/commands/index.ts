import { moderationCommands } from "../modules/moderation";
import { tempVoiceCommands } from "../modules/tempvoice";
import type { Command } from "./types";
import { ping } from "./ping";

/** Each module contributes its own command list; add new modules here. */
export const COMMANDS: Command[] = [ping, ...moderationCommands, ...tempVoiceCommands];

export const COMMANDS_BY_NAME = new Map(COMMANDS.map((c) => [c.data.name, c]));
