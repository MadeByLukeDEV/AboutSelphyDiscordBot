import { z } from "zod";

/** A Discord ID: digits only, 17-20 chars. Never a number (precision loss). */
export const snowflake = z.string().regex(/^\d{17,20}$/, "Invalid Discord ID");
export type Snowflake = z.infer<typeof snowflake>;
