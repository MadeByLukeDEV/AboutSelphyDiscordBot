import type { CASE_TYPES } from "../schema";

type CaseType = (typeof CASE_TYPES)[number];

// One colour per kind of action, so a long list can be scanned by colour alone:
// warnings amber, timeouts orange, kicks and bans red, unbans green, notes blue.
// Full class strings (not built up), or Tailwind can't see them. Badge text is
// the 800 shade on light and the 300 shade on dark, both AA on their tint.
export const CASE_STYLE: Record<CaseType, { bar: string; badge: string }> = {
  warn: { bar: "bg-amber-500", badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300" },
  timeout: { bar: "bg-orange-500", badge: "bg-orange-500/15 text-orange-800 dark:text-orange-300" },
  untimeout: { bar: "bg-slate-400", badge: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  kick: { bar: "bg-rose-500", badge: "bg-rose-500/15 text-rose-800 dark:text-rose-300" },
  ban: { bar: "bg-red-600", badge: "bg-red-600/15 text-red-800 dark:text-red-300" },
  unban: { bar: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300" },
  note: { bar: "bg-sky-500", badge: "bg-sky-500/15 text-sky-800 dark:text-sky-300" },
  antibot: { bar: "bg-violet-500", badge: "bg-violet-500/15 text-violet-800 dark:text-violet-300" },
};
