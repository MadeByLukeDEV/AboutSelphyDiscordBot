import type { Command } from "./types";
import { ping } from "./ping";

/** Add new commands here (or export a list from a module's commands.ts). */
export const COMMANDS: Command[] = [ping];

export const COMMANDS_BY_NAME = new Map(COMMANDS.map((c) => [c.data.name, c]));
