import { z } from "zod";

// The features that have a central on/off switch (dashboard /modules). One definition for the dashboard
// and the bot. Pure. Moderation, the dashboard itself, Twitch, YouTube and announcements are not here:
// moderation must never be switched off by accident, and the others have their own switches.
// Import it from "@aboutselphy/shared/modules" in client components.

export const MODULE_KEYS = [
  "welcome",
  "roles",
  "levels",
  "birthdays",
  "starboard",
  "counting",
  "giveaways",
  "polls",
  "suggestions",
  "tickets",
  "logs",
  "sticky",
  "autopublish",
  "statchannels",
  "customcommands",
  "autoresponders",
  "reminders",
  "utility",
  "tempvoice",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const isModuleKey = (v: unknown): v is ModuleKey => MODULE_KEYS.includes(v as ModuleKey);

export const MODULE_GROUPS = ["community", "engagement", "tools", "voice"] as const;
export type ModuleGroup = (typeof MODULE_GROUPS)[number];

type ModuleDef = {
  group: ModuleGroup;
  /** Slash commands that stop working while it is off. */
  commands: readonly string[];
  /** Button/menu/modal prefixes that stop working while it is off. */
  prefixes: readonly string[];
};

export const MODULES: Record<ModuleKey, ModuleDef> = {
  welcome: { group: "community", commands: [], prefixes: [] },
  roles: { group: "community", commands: [], prefixes: ["rp"] },
  levels: { group: "community", commands: ["rank", "leaderboard", "xp"], prefixes: [] },
  birthdays: { group: "community", commands: ["birthday"], prefixes: [] },
  starboard: { group: "community", commands: [], prefixes: [] },
  counting: { group: "community", commands: [], prefixes: [] },
  giveaways: { group: "engagement", commands: [], prefixes: ["gw"] },
  polls: { group: "engagement", commands: ["poll"], prefixes: ["pl"] },
  suggestions: { group: "engagement", commands: ["suggest", "suggestion"], prefixes: ["sg"] },
  tickets: { group: "engagement", commands: ["ticket"], prefixes: ["tk"] },
  logs: { group: "tools", commands: [], prefixes: [] },
  sticky: { group: "tools", commands: [], prefixes: [] },
  autopublish: { group: "tools", commands: [], prefixes: [] },
  statchannels: { group: "tools", commands: [], prefixes: [] },
  customcommands: { group: "tools", commands: ["tag", "tags"], prefixes: [] },
  autoresponders: { group: "tools", commands: [], prefixes: [] },
  reminders: { group: "tools", commands: ["remind"], prefixes: [] },
  utility: { group: "tools", commands: ["userinfo", "serverinfo", "roleinfo", "avatar"], prefixes: [] },
  tempvoice: { group: "voice", commands: ["tempvoice", "voice"], prefixes: ["tv"] },
};

/** The module a slash command belongs to, if it has a central switch. */
export function moduleOfCommand(name: string): ModuleKey | null {
  return MODULE_KEYS.find((k) => MODULES[k].commands.includes(name)) ?? null;
}

/** The module a component prefix ("tk" in "tk:open") belongs to, if it has a central switch. */
export function moduleOfPrefix(prefix: string): ModuleKey | null {
  return MODULE_KEYS.find((k) => MODULES[k].prefixes.includes(prefix)) ?? null;
}

export const moduleSwitchInput = z.object({ key: z.enum(MODULE_KEYS), enabled: z.boolean() });
export type ModuleSwitchInput = z.infer<typeof moduleSwitchInput>;
