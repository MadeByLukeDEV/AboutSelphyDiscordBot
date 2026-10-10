import { z } from "zod";
import { MAX_SCHEDULE_AHEAD_MS, MIN_SCHEDULE_AHEAD_MS } from "./announcement";

// What a poll may contain. One definition for the dashboard (form and Server Action), the /poll
// command and the bot. Pure and free of Node APIs. Import it from "@aboutselphy/shared/polls".

export const MAX_QUESTION = 300;
export const MAX_OPTION = 80;
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 10;

/** Splits "Pizza | Pasta | Salad" (also on new lines or semicolons) into clean, different options. */
export function parseOptions(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[|;\n]/)) {
    const option = part.replace(/\s+/g, " ").trim();
    const key = option.toLowerCase();
    if (!option || seen.has(key)) continue;
    seen.add(key);
    out.push(option);
  }
  return out;
}

const snowflake = z.string().regex(/^\d{17,20}$/);

export const pollInput = z
  .object({
    channelId: snowflake,
    question: z.string().trim().min(1).max(MAX_QUESTION),
    options: z.array(z.string().trim().min(1).max(MAX_OPTION)).min(MIN_OPTIONS).max(MAX_OPTIONS),
    multiple: z.boolean(),
    /** ISO time the poll closes; "" = it runs until a team member ends it. */
    endsAt: z.string().max(40),
  })
  .superRefine((v, ctx) => {
    const keys = v.options.map((o) => o.toLowerCase());
    if (new Set(keys).size !== keys.length) ctx.addIssue({ code: "custom", path: ["options"], message: "duplicate" });
    if (v.endsAt === "") return;
    const at = Date.parse(v.endsAt);
    if (Number.isNaN(at)) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "time" });
    else if (at < Date.now() + MIN_SCHEDULE_AHEAD_MS) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "past" });
    else if (at > Date.now() + MAX_SCHEDULE_AHEAD_MS) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "tooFar" });
  });
export type PollInput = z.infer<typeof pollInput>;
