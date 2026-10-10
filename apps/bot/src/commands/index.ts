import { moderationCommands } from "../modules/moderation";
import { tempVoiceCommands, voiceCommands } from "../modules/tempvoice";
import { levelCommands } from "../modules/levels";
import { birthdayCommands } from "../modules/birthdays";
import { customCommandCommands } from "../modules/customcommands";
import { pollCommands } from "../modules/polls";
import { reminderCommands } from "../modules/reminders";
import { suggestionCommands } from "../modules/suggestions";
import { ticketCommands } from "../modules/tickets";
import { twitchCommands } from "../modules/twitch";
import type { Command } from "./types";
import { help } from "./help";
import { ping } from "./ping";
import { utilityCommands } from "../modules/utility";

/** Each module contributes its own command list; add new modules here. */
export const COMMANDS: Command[] = [ping, help, ...utilityCommands, ...moderationCommands, ...tempVoiceCommands, ...voiceCommands, ...twitchCommands, ...levelCommands, ...ticketCommands, ...suggestionCommands, ...pollCommands, ...birthdayCommands, ...reminderCommands, ...customCommandCommands];

export const COMMANDS_BY_NAME = new Map(COMMANDS.map((c) => [c.data.name, c]));
