import { z } from "zod";

// Custom commands ("tags"): staff-written answers for /tag. One definition for the dashboard and the
// bot. Pure. Import it from "@aboutselphy/shared/custom-commands" in client components.

export const MAX_CUSTOM_COMMANDS = 100;
export const MAX_COMMAND_NAME = 32;
export const MAX_COMMAND_RESPONSE = 1800;
export const COMMAND_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** What a member types, tidied: lowercase, spaces become dashes. */
export const normalizeCommandName = (raw: string): string => raw.trim().toLowerCase().replace(/\s+/g, "-");

export const customCommandInput = z.object({
  id: z.string().min(1).max(64).optional(),
  /** Fixed once created. */
  name: z
    .string()
    .transform(normalizeCommandName)
    .refine((n) => COMMAND_NAME_PATTERN.test(n), "name"),
  response: z.string().trim().min(1).max(MAX_COMMAND_RESPONSE),
  ephemeral: z.boolean(),
  enabled: z.boolean(),
});
export type CustomCommandInput = z.infer<typeof customCommandInput>;
